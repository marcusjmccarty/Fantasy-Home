# Integration and public-read coalescing verification

This is the current integration record; the earlier graph verification documents are historical audit records.

## Base and preserved work

Latest integrated main: `e8eb5af937c4ab298713f815ee95c18633c86356` (v9.12.1). This adds only documentation/screenshots to `8f6e87c5692c457674480a5d711106bddecc153c`; application and test sources are identical.
Branch: `codex/graph-ui-integration-final`.

The tested original branch `codex/graph-accessibility-performance` and its two bundles remain intact. A first integration on `66feda9` was preserved as `codex/graph-ui-integration`; after main advanced, its commits were carried onto a new branch based on `8f6e87c`. The final documentation-only main advance was also carried into a new branch; all integrations applied without manual conflicts. A source comparison confirms application, package, script and test bytes match the fully tested 9.12.1 integration.

Only isolated graph focus/rendering/sizing/preference changes were carried forward. New home graph stat-help markup, in-place popovers, Points/Share chart destinations, tile click exclusions, scoring chart alignment, mobile formatting, and v9.12.1 asset URLs are retained. The original workspace checkout and main/live site are untouched. No push, merge-to-main, deployment, credentials, or paid operations were performed.

## Tests and measured UI results

- Full repository suite: **85 JS tests pass**, including three Miniflare checks; **7 Python tests pass**.
- **17 browser tests pass**: graph tab/focus order, resize, filtering, empty data, pending-search navigation, repeated open/history/close, hidden-to-visible changes, storage reloads, and latest UI links.
- The additional UI test verifies that home graph metric cards explain in place, Points opens Player Analytics, Share opens Opportunity, and Outlook/Opportunity/Trade title bars remain clickable.
- Syntax checks for changed application modules and `git diff --check` pass.
- Both layouts checked at 320, 390, 650, 730, 731, 960, 1280, and 1920px widths: no page/report horizontal overflow, labels at approximately 13px, no plot/statistics/export overlap. Screenshots inspected. The 960×540 check is a 200%-equivalent layout viewport, not native browser UI zoom. No Safari/Firefox/physical-device verification.
- Browser testing uses local static demo assets, mocked API reads and blocked nonlocal/non-GET requests.

Three alternating baseline/integrated browser runs used fresh Chromium contexts on the same cloud host. Baseline assets are exactly `8f6e87c`. Each run measures 12 Overview→Variable Lab transitions with the 36-point WR subset; first two excluded (30 samples per revision). Desktop viewport 1440×1000. Initial all-player graph has 107 points.

| Measurement | v9.12.1 main | Integrated |
| --- | ---: | ---: |
| SVG constructions on opening | 3 in every run | 1 in every run |
| Unchanged preference writes per tabbed resize | 1 | 0 |
| Hidden home redraws per tabbed resize | 1 | 0 |
| Median synchronous navigation | 11.15 ms | 8.65 ms |
| Median time to second animation frame | 19.75 ms | 13.70 ms |
| Median initial detailGraph, 3 runs | 20.20 ms | 17.10 ms |
| Median WR filter detailGraph, 3 runs | 9.00 ms | 6.30 ms |

These are instrumented local render/frame samples, not production latency, INP or final paint timestamps. Earlier baseline comparisons differ because of revision and run variation. No solver changes were made.

## Separate backend change

Implementation commit: `3170f2e` (ported from `6c055d1` / `8a98809`). Additional runtime/parameter acceptance coverage: `a7213eb`, `f4d9cae`.

`src/public-read-coalescer.js` keeps at most 32 in-flight keys. An existing key reuses its Promise. A new key at capacity runs normally without adding another retained entry. Each retained Promise removes itself on either fulfillment or rejection; synchronous throws are converted to rejection and release normally. Completed results and TTLs remain exclusively in the existing cache. This is a per-isolate optimization, not a global rate/concurrency limit.

The Worker applies this wrapper ONLY to existing cached public GET loaders, with unchanged keys:

| Endpoint | Exact key |
| --- | --- |
| `/api/nfl/game-status` | `${path}:${season}:${week}` |
| `/api/nfl/matchup-strength` | `${path}:${season}:${week}` |
| `/api/nflverse/advanced` | `path + season` |
| `/api/espn/player-overview` | `${path}:${id}:${name}` |

Existing integer validation is retained; player ID is validated numeric and display name truncated to 90 characters as before. Different IDs/names/weeks remain separate. Method/origin validation runs before loading. Private session, league import, free-agent and logout routes return through their original Durable Object route before reaching these loaders. AI generation, quota reservation, internal AI context loading, and the uncached news route are unchanged.

Public loaders do not consume caller Cookie/Authorization headers. Every caller receives independently constructed JSON Responses, not a shared body stream. The helper shares public parsed data only; it does not add user-specific caching or extend TTLs.

### Acceptance evidence

- The original actual-dispatcher fixture probe generated **20 upstream reads for 20 identical concurrent cold requests**. The integrated probe generates **1**, all responses 200. This is measured request reduction; synthetic delay timing is not a production speed claim.
- Warm reads add zero upstream calls. Expiry at the original 75-second TTL reloads and returns changed scoreboard state; no stale state is delivered after expiry.
- Upstream failure fans out the same error, clears the pending entry, and a later retry succeeds. Synchronous and asynchronous loader failures release their entries.
- Capacity test verifies sharing of admitted keys and normal independent execution for excess distinct keys; release allows subsequent new work.
- Public requests carrying different fictional Cookie/Authorization headers share only public data; neither header reaches upstream. Caller JSON mutation cannot affect another response or the cached result.
- Separate private session/free-agent requests route to their own objects independently. Existing real session fixture tests and private-cookie redirect checks still pass.
- Overview tests distinguish both player ID and display name. Cross-origin and invalid-method requests load nothing.
- Miniflare confirms 12 concurrent public requests produce one upstream call with no caller credentials. Another runtime test explicitly observes an aborted owner's rejected dispatch while its follower and subsequent request return 200, still using one upstream call.

All upstream responses were local fictional fixtures. No production endpoint was called.

## Measured backlog and limits

1. **Deferred, separate decision:** the completed cache still clears all 64 entries at capacity. A recently accessed unexpired entry was refetched after the clear. Coalescing intentionally does not change eviction policy.
2. **Deferred:** matchup-strength then game-status still fetches their common current-week scoreboard twice (3 total fixture calls for weeks 1 and 2). Shared underlying scoreboard caching needs explicit live-week freshness policy.
3. **Coordination:** separate keyboard-shortcut work has not been merged here. Keep its routing/help changes distinct from point-focus handling and rerun both suites when combining.
4. **Residual limits:** in-flight sharing is per Worker isolate; concurrent requests in different isolates still fetch independently. At 32 distinct pending keys, new distinct work is deliberately not retained/coalesced. Existing fallback/error-to-empty behavior, cache TTLs and capacity eviction are unchanged. Miniflare results do not prove provider acceptance or production load behavior.

The branch is ready for review, not publication. Preserve new UI handlers and release asset versioning when integrating. Recheck main immediately before any later integration/publication action.

## Bounded verification follow-up after focus commit 334595a

No application implementation changes were made in this follow-up. Cache implementation remains `3170f2ed9740f46f7f657a8c5ddd82536540514e`; private and AI paths remain unchanged.

- Exact saturation fixture through the Worker: 32 distinct held public keys + 100 callers for the same untracked overflow key = **132 upstream loads**. One extra caller for an admitted key shares its load (133 client responses total). All return 200; a subsequent warm overflow-key read adds zero loads. The bound is **tracked pending keys only, not upstream concurrency**. Internal helper results share object references; it does not clone them.
- Deterministic timeout fixture asserts `AbortSignal.timeout(23000)` for public upstream loads, manually aborts that signal, observes eight shared callers returning 502, confirms unrelated-key progress while they wait, then verifies successful retry. This tests abort handling and cleanup with a controlled signal, not elapsed 23-second timing or production timeout behavior. The unchanged 28-second AI deadline was not newly exercised.
- Actual Miniflare HTTP dispatch confirms distinct Response instances and independent body consumption. Parsing and mutating the first response before consuming the others changes neither their parsed payloads nor a later cached HTTP response. This verifies the serialization boundary, not internal object immutability.
- Seven focus regressions added at `334595a` bring the existing browser suite to 24 passing tests (last executed at that commit). This test/documentation-only follow-up does not change frontend bytes.
- Full JS suite after the added checks: 87 passed, 0 failed. Existing Python suite: 7 passed.
- GitHub main was rechecked as `e8eb5af937c4ab298713f815ee95c18633c86356`.
- Combined keyboard integration remains blocked: its Library archive download failed twice with no bytes. No further transfer attempts or combined-validation claims.
