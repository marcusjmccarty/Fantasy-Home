# GRIDIRON/86 v9.9 verification

## Automated checks

- `npm test`: 54 passing JavaScript checks, including Cloudflare runtime integration.
- `python3 -m unittest discover -s test -p test_usage.py`: 7 passing play-by-play aggregation checks.
- Syntax checks for changed browser/Worker scripts and `git diff --check` passed.
- Historical Outlook values exclude the requested/future week; the table is chronological. An asymmetric sample confirms that the projection marker is not forced to the midpoint.
- TD estimates require explicit TD coverage and four prior recorded weeks, ignore future games, preserve observed zeroes, and suppress unavailable-player estimates. The dataset credits the actual TD scorer, including lateral recipients, without crediting passing QBs with receiving TDs.
- Trade tests cover eligible-slot optimization, FLEX/SUPERFLEX, consolidation, both teams’ lineup impacts, missing estimates, optional drops, and unchanged league rosters.
- AI context tests check verified opponents, position-relevant league comparisons, observed recent workload, and missing-data handling.

## Live browser checks

Tested the deployed application using its synthetic exhibition league; no private league credentials were required.

- 1920 × 1080 desktop: full-width layout; 38px clickable modal side margins. Outlook range/history panels have matching bottom edges; weeks read W1–W6 from top to bottom.
- Clicked the backdrop to close an expanded window successfully.
- Opportunity leaders: Every Player → Active Franchise repeated twice; counts changed 90 → 6, selected James Cook remained intact, and the page stayed mounted.
- Clicking an entire leader row updated the snapshot; double-clicking opened that player’s terminal.
- Weekly share bar W3 opened the W3 starter-scoring contribution view. Clicking the share panel heading opened Touches & Share.
- Restored scouting facts appear beside the compact range summary; the duplicated prior-history table is absent from the Scouting File.
- Variable Lab: the complete graph fit a 1280 × 720 laptop viewport; the gap between graph statistics and enrichment controls was 7px in both windowed and tabbed views, with no artificial top margin.
- Trade: selected packages produced the same -1.7 point package and lineup differences; a simulated QB drop correctly made a complete lineup unavailable. The counteroffer workbench reported when no single-player addition improved balance. A follow-up regression checks that additions that can fill both starting lineups are prioritized over balance alone.
- 390 × 844 phone: document width remained 390px without horizontal page overflow; expanded window retained 14px outer margins and its content scrolled internally.
- No browser JavaScript errors during these flows.

## Data and model boundaries

The TD metric is a conditional Poisson scenario using observed rushing/receiving TD frequency, four position-cohort prior-equivalent weeks, and a capped recent-workload multiplier. It is not an externally calibrated probability or betting line. Source and methodology are in the report disclosure rather than the removed status ribbon.

The trade workbench compares weekly scoring and real eligible starting lineups from loaded rosters. It does not invent dynasty, keeper, draft-pick, market-consensus or rest-of-season feeds, and never submits a trade. Format and optional drops are explicit user-controlled assumptions.

The AI receives role-relevant efficiency comparisons and workload evidence, with directions to explain mechanisms, downside/upside paths and uncertainty. A live qualitative review prompted a second refinement to reduce numerical recitation and eliminate duplicated stat tables from its input.
