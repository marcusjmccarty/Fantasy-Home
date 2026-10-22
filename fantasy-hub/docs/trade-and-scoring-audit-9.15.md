# v9.15 trade and weekly scoring audit

## Findings and changes

The maximum-weight assignment solver already correctly optimized starting slots. It was checked against an independent exhaustive search across 80 varied rosters and slot formats. A player is assigned once; ESPN slot eligibility is authoritative; FLEX and superflex compete for players rather than duplicating them. No optimizer replacement was needed.

The home trade display did not use this analysis: it only compared package sums. It now uses the same evaluator as the expanded calculator and prominently shows each team's change in its best starting lineup. Bench players contribute only when they enter that lineup. The circle still measures package balance, while the blue/red bar explicitly describes the share of exchanged value. Neither is a win probability or the primary trade verdict.

The default valuation is now the selected week's provider projections. Actual points already earned are never a player's trade value. The optional recent-form blend remains available. Projections carry their week; another week's cached projection cannot silently substitute. A missing projection remains unknown. OUT, IR, suspended and explicitly recorded bye-week players score zero in the active-week trade model; current availability does not rewrite historical weeks. Demo projections are synthetic and derive only from prior fictional scores.

Automatic balancing pieces now improve the weaker starting lineup (or restore a missing required slot), instead of merely making package sums closer. The exhaustive small-package recommendation search still requires both optimized lineups to improve and accounts for bench drops on the side receiving more players. Manual unequal packages show required drops; all proposed drops are included in the lineup calculation. Roster-size checks conservatively preserve each team's loaded roster count.

The home package list had a 64-pixel scroll cap, which made it look limited to two players. It now displays every selection in a responsive grid, with compact spacing for larger packages. The balance circle occupies the middle between the two lineup impacts.

## Weekly matchup scoring

ESPN statistical source IDs now take precedence over legacy type fields. Weekly actuals and projections must match the requested period. An entry-level total is accepted only within a matching roster context and cannot override explicitly different-week actuals. Basic roster projections are retained even before the first 0–0 matchup receives a historical box score.

Both matchup views use a shared total: actual points for games in progress or finished, projections for unplayed games. Confirmed zero and negative results are preserved. If game state is unavailable, a nonzero current-week score is evidence of play; zero alone is not. Unknown required values leave a total unavailable rather than showing a misleading partial sum. Historical weeks retain official results, and official points stay separately visible in the expanded table. Once all starters finish, the official total takes precedence. Game-status caches include season and week and are revalidated after 75 seconds on subsequent requests. Fantasy scores remain the latest connected-league snapshot; Refresh retrieves a new snapshot.

## Scope and checks

This is a weekly scoring/lineup calculator, not a rest-of-season, dynasty or draft-pick model. It optimizes hypothetical lineups; it does not execute trades, change ESPN rosters, enforce trade deadlines, or assume already-earned points transfer with a player. Availability and scoring are only as current as the provider snapshot.

Regression coverage includes bench-only swaps, consolidation, FLEX and custom ESPN eligibility, duplicate/numeric IDs, zero/negative values, missing estimates, injuries, optional drops, week-bound projections, pregame/live/final scoring, pregame 0–0 ESPN fixtures and home/expanded trade parity. Workspace checks cover independent windowed franchises and synchronized tabbed franchises. Responsive visual verification is recorded after deployment.
