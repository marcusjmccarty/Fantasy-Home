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
