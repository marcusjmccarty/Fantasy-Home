# GRIDIRON/86 v9.9.1 optimization verification

## Performance

Run `node scripts/benchmark-analytics.mjs /tmp/fantasy-analytics-before.js` with the prior version's `public/analytics-math.js` exported from commit `2ae3217` to that temporary path. The script performs three warmups and nine timed samples of 19 counteroffers, using two 20-player rosters, twelve prior scoring weeks and ten starting slots including SUPERFLEX.

| Analytics version | Median | Range | Result checksum |
| --- | ---: | ---: | ---: |
| v9.9 | 163.81ms | 163.25–181.07ms | 323.866667 |
| v9.9.1 | 91.87ms | 91.49–92.49ms | 323.866667 |

Median computation time was approximately 44% lower in this same-host Node VM benchmark. This does not measure network latency, browser rendering or whole-site load time. Results depend on the device and roster.

## Correctness and interaction checks

- 58 JavaScript tests and 7 Python data-processing tests pass, including Cloudflare runtime integration.
- The optimized lineup solver is checked against exhaustive slot-by-slot assignment in 80 deterministic cases, covering five valuation modes, duplicate player IDs, missing values, negative points, repeated positions, FLEX and SUPERFLEX.
- Trade batches read player valuations once; new batches reflect changes to projections, week and valuation mode. Optional drops and both teams' optimized lineups remain covered.
- Unchanged home panels perform no DOM replacements. Changed scoring data still updates the Outlook. Trade edits leave unrelated strategy panels and player charts mounted.
- Counteroffer comparisons use one evaluator per batch and continue prioritizing complete starting lineups.
- No scoring formulas, external providers, credentials or theme styles were changed.

## Live deployment

The live root page reports edition 9.9.1, and the deployed analytics asset matches the committed file byte for byte. Tested with the explicitly synthetic exhibition league:

- Opened the floor explanation, added James Cook and Avery Knight 1 in the home trade tile, and confirmed the explanation remained open while the package difference updated to -1.7.
- Sent Cook plus McCaffrey and compared additions. The workbench prioritized running backs that restore complete lineups ahead of a quarterback package with a higher scoring balance but an incomplete lineup.
- Applied a recommendation; the expanded calculator showed -10.9 / +10.9 lineup effects, and the home tile matched its -10.9 package difference. Changing valuation to history updated the package totals, and returning to balanced restored them.
- Selecting Cook on the home Share tile synchronized both player selectors and the weekly share chart.
- Every Player → Active Franchise filtering, row selection and double-click Player Terminal navigation worked without a page reload.
- Switching to Tabbed preserved the trade package. No browser JavaScript errors were recorded during these checks.

[Live calculator verification](screenshots/optimized-trade-9.9.1.jpg)
