#!/usr/bin/env python3
"""Precompute NFL opportunity data; never process whole-season PBP in a Worker.
Source dictionary: https://nflreadr.nflverse.com/articles/dictionary_pbp.html
"""
import argparse, csv, gzip, io, json, urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

FIELDS=('carries','targets','receptions','redzone_carries','redzone_targets','inside10_carries','inside10_targets','inside5_carries','inside5_targets')
UNIT_FIELDS=('plays','yards','yard_plays','pass_plays','pass_yards','pass_yard_plays','rush_plays','rush_yards','rush_yard_plays','sacks','turnovers','explosives','redzone_plays','epa','epa_plays','successes')
def number(v):
    try: return float(v)
    except (TypeError, ValueError): return None

def aggregate(rows, identities=None, season=2026):
    identities=identities or {}
    players={}; teams=defaultdict(lambda:defaultdict(lambda:dict.fromkeys(FIELDS,0)))
    seen=set(); weeks=set(); games=set(); units={}
    for r in rows:
        if r.get('season_type')!='REG' or r.get('play_type') in ('no_play','qb_kneel','qb_spike') or any(number(r.get(flag))==1 for flag in ('two_point_attempt','qb_kneel','qb_spike','no_play')): continue
        week=number(r.get('week'));team=r.get('posteam');game=r.get('game_id');play=r.get('play_id')
        if not week or week>18 or not team or not game or not play: continue
        key=(game,play)
        if key in seen: continue
        seen.add(key);week=int(week);yard=number(r.get('yardline_100'))
        # Team units include sacks and untargeted passes, unlike player targets.
        # Keep denominators so missing yardage/EPA never becomes a zero.
        if r.get('play_type') in ('run','pass') and r.get('defteam'):
            passing=number(r.get('pass_attempt'))==1
            rushing=number(r.get('rush_attempt'))==1
            if passing or rushing:
                weeks.add(week);games.add(game)
                y=number(r.get('yards_gained'));epa=number(r.get('epa'))
                values=dict.fromkeys(UNIT_FIELDS,0)
                values.update(plays=1,pass_plays=int(passing),rush_plays=int(rushing),sacks=int(number(r.get('sack'))==1),turnovers=int(number(r.get('interception'))==1 or number(r.get('fumble_lost'))==1),redzone_plays=int(yard is not None and 0<yard<=20))
                if y is not None:
                    values.update(yards=y,yard_plays=1,explosives=int(y>=(20 if passing else 10)))
                    if passing: values.update(pass_yards=y,pass_yard_plays=1)
                    if rushing: values.update(rush_yards=y,rush_yard_plays=1)
                if epa is not None: values.update(epa=epa,epa_plays=1,successes=int(epa>0))
                for abbr,side in ((team,'offense'),(r['defteam'],'defense')):
                    unit=units.setdefault(abbr,{}).setdefault(str(week),{}).setdefault(side,{'game_ids':[],**dict.fromkeys(UNIT_FIELDS,0)})
                    if game not in unit['game_ids']: unit['game_ids'].append(game)
                    for field,value in values.items(): unit[field]+=value
        events=[]
        if number(r.get('rush_attempt'))==1 and r.get('rusher_player_id'): events.append(('rusher','carries'))
        if number(r.get('pass_attempt'))==1 and r.get('receiver_player_id') and number(r.get('sack'))!=1: events.append(('receiver','targets'))
        if not events: continue
        weeks.add(week);games.add(game)
        for prefix,kind in events:
            pid=r[prefix+'_player_id'];identity=identities.get(pid,{})
            p=players.setdefault(pid,{'gsis_id':pid,'espn_id':str(identity.get('espn_id') or ''),'name':identity.get('name') or r.get(prefix+'_player_name') or pid,'position':identity.get('position') or '', 'weeks':{}})
            row=p['weeks'].setdefault(str(week),{'team':team,**dict.fromkeys(FIELDS,0)})
            totals=teams[team][str(week)]
            metrics=[kind]
            if kind=='targets' and number(r.get('complete_pass'))==1: metrics.append('receptions')
            for limit,label in ((20,'redzone'),(10,'inside10'),(5,'inside5')):
                if yard is not None and 0<yard<=limit: metrics.append(label+'_'+kind)
            for metric in metrics: row[metric]+=1;totals[metric]+=1
    # Denominators include every identified opportunity for that offense, even
    # players absent from the fantasy pool. Each row carries its own team/week.
    for p in players.values():
        for week,row in p['weeks'].items(): row['team_totals']=teams[row['team']][week]
    return {'schema':1,'season':season,'source':'nflverse play-by-play','generated_at':datetime.now(timezone.utc).isoformat(),'through_week':max(weeks,default=0),'weeks':sorted(weeks),'games':len(games),'basis':'Recorded regular-season plays; penalties marked no_play, kneels, spikes and two-point attempts excluded. Targets require an identified receiver. Red zone ≤20 yards; inside 10 ≤10; goal line ≤5. Shares use team opportunities during the player’s reported weeks.','players':list(players.values()),'units':units}

def download(url):
    return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'GRIDIRON86 opportunity builder'}),timeout=120)

def build(season,output):
    root='https://github.com/nflverse/nflverse-data/releases/download'
    identities={}
    # Match provider IDs, never fuzzy names, when the roster crosswalk is present.
    with download(f'{root}/rosters/roster_{season}.csv') as response:
        for r in csv.DictReader(io.TextIOWrapper(response,encoding='utf-8-sig')):
            if r.get('gsis_id'): identities[r['gsis_id']]={'name':r.get('full_name') or r.get('football_name'),'position':r.get('position'),'espn_id':r.get('espn_id')}
    with download(f'{root}/pbp/play_by_play_{season}.csv.gz') as response:
        with gzip.GzipFile(fileobj=response) as decompressed:
            data=aggregate(csv.DictReader(io.TextIOWrapper(decompressed,encoding='utf-8-sig')),identities,season)
    if not data['players'] or not data['through_week']: raise RuntimeError('No usable plays; retaining the previous dataset.')
    output=Path(output);output.parent.mkdir(parents=True,exist_ok=True)
    temporary=output.with_suffix('.tmp');temporary.write_text(json.dumps(data,separators=(',',':')));temporary.replace(output)
    print(f"Published {len(data['players'])} players through week {data['through_week']} ({data['games']} games)")

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--season',type=int,default=datetime.now(timezone.utc).year if datetime.now(timezone.utc).month>=3 else datetime.now(timezone.utc).year-1);parser.add_argument('--output');args=parser.parse_args()
    if not 1999<=args.season<=2100: parser.error('Season must be between 1999 and 2100.')
    build(args.season,args.output or f'fantasy-hub/public/data/usage-{args.season}.json')
