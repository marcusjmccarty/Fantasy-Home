# Per-render free-agent sort verification

Base: `f447a3dbf7c9dcdac7ff4eb8907f241dda5d2a31`. Application change is limited to `agentList()` in explorer.js. Calculate each filtered player's existing metricValue once, sort those temporary records with the original comparator semantics, then return original player references. No persistent cache, filter, debounce, focus, keyboard, solver or rendering change.

## Correctness

101 JS tests and 7 Python tests pass. Four added tests cover 2,400 ordering comparisons with the frozen previous implementation across pools 0/1/14/60/300/1000, all five UI sorts, eight position settings and ten search variants. Additional coverage checks every metric key, raw/advanced overrides, null/NaN/Infinity/zero/negative values, stable ties, identity/nonmutation, updates between calls and one metric evaluation per filtered player. 39 existing graph/UI/AI browser cases and all four keyboard scripts pass on the candidate. The browser scripts were copied to scratch only to target port 8771; assertions were unchanged.

## Paired interaction measurement

Run `scripts/benchmark-agent-search.cjs` against separately served baseline/candidate public directories. Set PLAYWRIGHT_MODULE if Playwright is installed outside the app. No installation or external requests are required. All API reads are fictional local responses and nonlocal/non-GET traffic is blocked.

Chromium, 1440×1000, fresh context per scenario. Three alternating base/candidate rounds, eight input changes each, first two excluded: **18 retained samples per revision/scenario, 432 total**. Queries alternate a and empty, default projected sort. Larger pools clone fictional demo players and are stress fixtures, not measured user dataset sizes. CPU throttling is explicitly shown; 4× is a simulation, not a physical mobile-device result.

Timing starts at input event dispatch and ends at the second animation-frame callback after rendering. It includes existing 170ms expanded-search debounce but is not INP, final paint or network-inclusive production latency. Both revisions use identical instrumentation. p95 is interpolated from 18 samples and is descriptive, not a robust population tail estimate. The final run was performed after regression tests finished to avoid test/benchmark CPU contention. Raw samples: `docs/benchmarks/agent-search-paired.json`.

| CPU | Pool | Report | Base median / p95 ms | Candidate median / p95 ms | Base → candidate render median ms |
| --- | ---: | --- | ---: | ---: | ---: |
| 1× | 14 | home | 31.7 / 32.4 | 31.3 / 32.0 | 1.1 → 1.0 |
| 1× | 14 | agents | 180.3 / 202.5 | 180.2 / 202.2 | 2.7 → 2.4 |
| 1× | 300 | home | 31.8 / 32.4 | 31.4 / 32.1 | 9.0 → 2.2 |
| 1× | 300 | agents | 220.1 / 223.0 | 213.1 / 218.2 | 25.1 → 18.5 |
| 1× | 1000 | home | 31.8 / 36.5 | 32.0 / 32.5 | 26.6 → 3.9 |
| 1× | 1000 | agents | 237.7 / 245.4 | 214.4 / 216.7 | 43.9 → 20.0 |
| 4× | 14 | home | 31.4 / 40.2 | 30.5 / 35.9 | 4.9 → 3.8 |
| 4× | 14 | agents | 212.6 / 218.8 | 208.4 / 211.5 | 10.9 → 9.6 |
| 4× | 300 | home | 58.8 / 72.5 | 35.1 / 40.9 | 36.9 → 9.9 |
| 4× | 300 | agents | 385.4 / 426.9 | 359.0 / 384.7 | 106.2 → 80.8 |
| 4× | 1000 | home | 135.2 / 176.5 | 37.7 / 50.5 | 111.8 → 15.8 |
| 4× | 1000 | agents | 447.5 / 485.5 | 359.5 / 386.4 | 179.1 → 85.4 |

## Interpretation and tradeoff

At 4× throttle, the 1,000-player stress pool improved home-search median from 135.2 to 37.7ms and expanded-search median from 447.6 to 359.5ms. The 300-player case improved from 58.8 to 35.1ms home and 385.4 to 359.1ms expanded. Unthrottled expanded 1,000-player search improved 237.7 to 214.4ms.

The 14-player demo has little user-visible gain. Unthrottled home-search median remains around the two-frame floor even for 1,000 players; do not claim meaningful improvement there. Expanded table rendering/debounce still dominate much of its delay and are outside this patch.

For 1,000-player home searches the median summary count falls from 13,427 to 942.5 (queries alternate different filtered sizes). Sorting remains O(n log n); expensive metric preparation becomes O(n). Cost: one short-lived object per filtered player and two map passes, instead of the previous copied array. No cross-render invalidation or cache lifecycle is introduced. This complexity is bounded and preserves metric overrides by calling the existing accessor, rather than shortcutting individual fields.

No main merge or deployment is included in this draft. Keyboard redesign and UI proposals are excluded. Prior rollout approval is not treated as permission to deploy this change before independent review.
