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
