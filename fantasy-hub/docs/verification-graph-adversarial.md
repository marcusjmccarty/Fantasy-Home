# Adversarial graph follow-up

Starting branch head: `cada1c5d5331c69c9386910d739b6c0e8f69fde5`.
The first batch and its original bundle are preserved. This pass adds no dependencies or platform changes.

## Confirmed failure and fix

Typing into graph search schedules a 170ms debounce. If the user opens Roster before it fires, the old callback called `renderExplorer()` for the new report, replacing the destination table and dropping its focus. The baseline test observed `destination.isConnected === false`. Closing and reopening a graph could similarly allow an old callback to replace the new graph.

The graph callback now returns unless Graph is still the active report AND the originating input is still connected. Both conditions matter: checking the report alone would not protect a newly opened graph. No other report callback or navigation routing changed.

Commit `2f597d3` contains the one-line callback guard and the added browser coverage. No graph semantics, visual styling, home tile links, shortcut behavior, or solver code changed.

## Coverage and results

The original 9 browser checks still pass, plus 7 new checks:

- 12 modal open → roster → back → forward → close cycles.
- Focused point excluded by position filtering, then all points excluded by search: focus stays on the live filter/search control; search caret remains correct.
- 120 same-size resize events cause zero SVG rebuilds. Twenty viewport size changes preserve focused point 0 and finish with matching measured plot/viewBox dimensions.
- Eight hidden/visible and roster-table/graph transition cycles leave one live expanded graph, no stale chart in the table, and a visible refreshed home graph on return.
- Tabbed Graph preference restores across reload; Dashboard stays closed after reload and remembers Graph for return to Tabbed.
- Pending search cannot replace the destination roster or lose table focus.
- Pending search from a closed graph cannot replace or focus the newly opened graph.

Initial adversarial run: 5 of 6 checks passed; stale destination-table callback failed. After the fix: **16/16 total browser tests pass**, including the extra close/reopen case. Repository checks: **73 JS and 7 Python tests pass**; syntax checks and `git diff --check` pass. All browser traffic remains local demo GET assets with mocked API reads and blocked external/non-GET requests. Browser coverage is Chromium, not Safari/Firefox/native mobile hardware.

Run `node --test scripts/check-graph-browser.cjs` with the local static server and optional `PLAYWRIGHT_MODULE` described in the first verification document. No performance optimization was added in this follow-up, so earlier paired timings remain historical evidence, not newly claimed timings.

## Read-only performance opportunities outside graph/solver/UI ownership

All evidence below comes from importing the actual Worker dispatcher with `globalThis.fetch` replaced by fictional local scoreboard fixtures. No real upstream request was made. The backend source is unchanged. Request counts are the useful measurement; artificial delay timing is not production latency.

1. **First priority: coalesce simultaneous public GET cache misses.** `src/worker.js:45` populates `publicCache` only after `load()` resolves. Twenty simultaneous identical `/api/nfl/game-status` requests produced **20 upstream calls**, all returned 200; a subsequent warm request produced zero. Proposed next work: a bounded in-flight Promise map scoped to public GET loaders, remove rejected entries so retry works, preserve TTL/error behavior and response isolation. Do not indiscriminately change the shared helper's AI quota or private-session semantics. Acceptance: 20 identical cold reads use one upstream call; distinct keys stay independent; rejection allows a later retry.
2. **Second priority: avoid clearing the entire public cache at capacity.** The helper clears all entries when size reaches 64. A key served from cache immediately before two new insertions was fetched again after the capacity clear, despite its 75-second TTL still being valid. Proposed work: expire old entries first, then evict one least-recently-used entry while keeping the bound. Acceptance: a recently read unexpired key remains cached across unrelated misses; maximum size remains bounded; expired data is never returned.
3. **Lower priority: reuse scoreboard fetches across public endpoints.** `/api/nfl/matchup-strength?season=2090&week=2` followed by `/api/nfl/game-status?season=2090&week=2` caused three fixture requests: week 1 once, week 2 twice. `scoreboard()` at line 27 has no common cache even though its consumers have separate response caches. Proposed work: share the underlying public scoreboard read with explicit short TTL for live weeks, preserving freshness and historic semantics. Acceptance: matching endpoints reuse current-week data within the allowed TTL and refresh afterward. Real traffic frequency is unknown; prioritize only after the simpler duplicate-miss issue.

No new-area changes are authorized by this evidence document; these remain proposals for coordination/review.

## Integration

The code touchpoint is the graph-search branch of the `explore-content` input listener in `public/explorer.js` (near line 2171). It can overlap ongoing UI edits to the shared listener; preserve the guard when integrating. New tests append to `scripts/check-graph-browser.cjs`. No keyboard handler or home-link correction was implemented here.

Remote main was `74c137e48dfa1b83fb7621a162aacdfaf45195ef` at pass start, but advanced to `66feda98f4f806a48ee88a9ba8aa27b129a5ebf2` at the final check. The new commit restores Star tile navigation and revises player, matchup and trade layouts, including home graph stat popovers and adjacent resize-handler context in explorer.js. It leaves workspace.js and refinements.css unchanged. The graph-search callback itself is unchanged upstream, though new initialization code is appended nearby. Do not replace the whole explorer.js file during integration: preserve the new renderGraphHome stat-help markup, home stat popover behavior, chart-surface navigation and tile click exclusions. This branch has NOT been rebased or merged onto the new main, and the combined revision has NOT been tested. Reapply the isolated commits carefully and rerun both owners' browser coverage during integration. No push, merge, deployment, credential change, or paid action occurred.
