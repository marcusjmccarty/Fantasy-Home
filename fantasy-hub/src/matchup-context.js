// Aggregate published, observed NFL plays strictly before the requested week.
export function summarizeUnits(data,week){
 const result={};
 for(const [team,weeks] of Object.entries(data?.units||{})){
  result[team]={};
  for(const side of ['offense','defense']){
   const rows=Object.entries(weeks).filter(([w,r])=>Number(w)>0&&Number(w)<week&&r[side]).map(([,r])=>r[side]);
   if(!rows.length)continue;
   const total=k=>rows.reduce((sum,r)=>sum+(Number(r[k])||0),0);
   const games=new Set(rows.flatMap(r=>r.game_ids||[])).size;
   const ratio=(a,b,m=1)=>total(b)>0?+(total(a)/total(b)*m).toFixed(2):null;
   result[team][side]={games,plays:total('plays'),yardsPerPlay:ratio('yards','yard_plays'),netPassYardsPerPlay:ratio('pass_yards','pass_yard_plays'),rushYardsPerPlay:ratio('rush_yards','rush_yard_plays'),sacks:total('sacks'),sackRate:ratio('sacks','pass_plays',100),turnovers:total('turnovers'),turnoversPerGame:games?+(total('turnovers')/games).toFixed(2):null,explosiveRate:total('yard_plays')?+(total('explosives')/total('yard_plays')*100).toFixed(2):null,redzonePlays:total('redzone_plays'),epaPerPlay:ratio('epa','epa_plays'),successRate:ratio('successes','epa_plays',100)};
  }
 }
 return result;
}

export function playerWorkload(data,player,week){
 const names=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const pool=data?.players||[],idMatch=pool.find(r=>r.espn_id&&String(r.espn_id)===String(player.id));
 const named=pool.filter(r=>names(r.name)===names(player.name));
 const row=idMatch||(named.length===1?named[0]:null);
 const weeks=Object.entries(row?.weeks||{}).filter(([w])=>Number(w)>0&&Number(w)<week).sort((a,b)=>Number(a[0])-Number(b[0])).map(([,r])=>r);
 if(!weeks.length)return null;
 const sum=k=>weeks.reduce((s,r)=>s+(Number(r[k])||0),0),carries=sum('carries'),targets=sum('targets'),receptions=sum('receptions');
 const recent=weeks.slice(-3),avg=(rows,key)=>rows.reduce((s,r)=>s+Number(r[key]||0),0)/rows.length;
 return {recordedWeeks:weeks.length,carries,targets,receptions,touches:carries+receptions,opportunities:carries+targets,touchesPerRecordedWeek:+((carries+receptions)/weeks.length).toFixed(2),redzoneCarries:sum('redzone_carries'),redzoneTargets:sum('redzone_targets'),inside5Carries:sum('inside5_carries'),recentThree:{recordedWeeks:recent.length,carriesPerWeek:avg(recent,'carries'),targetsPerWeek:avg(recent,'targets'),redzoneChancesPerWeek:avg(recent,'redzone_carries')+avg(recent,'redzone_targets')},seasonTargetsPerWeek:targets/weeks.length,seasonCarriesPerWeek:carries/weeks.length,basis:'NFLverse recorded plays strictly before requested week; no-play penalties, kneels, spikes and two-point attempts excluded'};
}

export function unitComparisons(units,team,side){
 const unit=units?.[team]?.[side];if(!unit)return null;
 const keys=['yardsPerPlay','netPassYardsPerPlay','rushYardsPerPlay','sackRate','turnoversPerGame','epaPerPlay','successRate','explosiveRate'];
 return Object.fromEntries(keys.map(key=>{
  const values=Object.values(units).map(t=>t[side]?.[key]).filter(Number.isFinite),value=unit[key];
  if(!values.length||!Number.isFinite(value))return [key,null];
  const mean=values.reduce((a,b)=>a+b,0)/values.length;
  return [key,{value,leagueUnitMean:+mean.toFixed(3),differenceFromMean:+(value-mean).toFixed(3),teams:values.length,basis:'Unweighted mean of team rates; not opponent-adjusted'}];
 }));
}

// Give the analyst a focused evidence file rather than duplicate stat tables.
export function focusMatchupFacts(facts){
 const defense=['DEF','D/ST'].includes(facts.position),runner=facts.position==='RB';
 const keys=defense?['sackRate','turnoversPerGame','epaPerPlay']:runner?['rushYardsPerPlay']:['netPassYardsPerPlay','sackRate'];
 const pick=(source,includeValue)=>source?Object.fromEntries(keys.filter(k=>source[k]!=null).map(k=>[k,{...(includeValue?{observed:source[k].value}:{}),comparisonToLeague:Math.abs(source[k].differenceFromMean)<.01?'near the unweighted league team average':source[k].differenceFromMean>0?'above the unweighted league team average':'below the unweighted league team average'}])):null;
 facts.opponentVsLeague=pick(facts.opponentVsLeague,true);facts.ownUnitVsLeague=pick(facts.ownUnitVsLeague,false);
 // The comparisons already contain the underlying observed value and mean.
 delete facts.opponentPlayByPlay;delete facts.ownPlayByPlay;
 facts.interpretationLimits='No guaranteed future touches or workload, no player workload rankings, and no positional fantasy-points-allowed data. Matchup team rates are not opponent-adjusted. A recent role can change. A low receiving target count is not an observed target-share percentage.';
 if(facts.opponentScoring)facts.opponentScoring={pointsPerGame:facts.opponentScoring[defense?'offensePPG':'defenseAllowedPPG'],meaning:defense?'NFL points scored by opposing offense':'NFL points allowed by opposing defense'};
 const workload=facts.playerWorkload;
 if(workload){
  facts.playerWorkload={recordedWeeks:workload.recordedWeeks,seasonCarriesPerWeek:workload.seasonCarriesPerWeek,seasonTargetsPerWeek:workload.seasonTargetsPerWeek,recentThree:workload.recentThree,inside5CarriesPerWeek:workload.inside5Carries/workload.recordedWeeks,redzoneCarriesPerWeek:workload.redzoneCarries/workload.recordedWeeks,redzoneTargetsPerWeek:workload.redzoneTargets/workload.recordedWeeks,basis:workload.basis};
 }
 return facts;
}

export function lineupEvidence(input,position){
 if(!input||!['QB','RB','WR','TE','K','DEF','D/ST'].includes(position))return null;
 const {leagueSize,rank,peers,basis}=input;
 if(!Number.isInteger(leagueSize)||leagueSize<2||leagueSize>32||!Number.isInteger(rank)||rank<1||!Number.isInteger(peers)||peers<rank||peers>1000||!['provider projections','prior scoring averages'].includes(basis))return null;
 const band=Math.ceil(rank/leagueSize),enough=peers>=leagueSize;
 return {leagueSize,position,rankInLoadedPool:rank,playersWithComparableData:peers,basis,scoring:['PPR','FULL PPR','HALF PPR','STANDARD','CUSTOM','CUSTOM SCORING'].includes(input.scoring)?input.scoring:'League scoring',provisionalTier:!enough?'Insufficient peer coverage':['RB','WR'].includes(position)?band<3?position+band:band===3?'Flex-range':'Depth / emergency flex':band===1?position+'1':band===2?'Streaming option':'Bench depth',scope:'League rosters and loaded free agents only, not a complete NFL ranking. A tier is one league-sized band of this pool. Prior averages are descriptive, not projections.'};
}
