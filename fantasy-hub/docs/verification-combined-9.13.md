# Combined graph/performance and keyboard verification

Base main: `2a532e4f24e0e0f0d2173ccc2148b024dcb7e317` (v9.13).
Performance input: `e93ee98cfa22943c9ddfbaf219e5cab6c86e0900` (PR 1).
Keyboard input: `bf1b10356100b7403fc10f35a4d808651fb7d697` (PR 2).

Preserved original combined merge on e8 main: `4cbd0178e07d894fc9d16012586b5956219d7856`, branch `codex/combined-e8-verified`.
Latest-main integration merge: `fa2e4c4d9d68b1f3275b5d13dbe1b62dcdd91cb8`, branch `codex/combined-performance-keyboard-913`.

## Resolution

The first two candidates merged without conflicts. Main advanced during verification, so a new branch was created from v9.13 and the preserved combined candidate was merged into it. Two conflicts were resolved:

- index.html: keep v9.13 asset versions and latest home markup; retain the keyboard script, help controls, help dialog and accurate footer.
- worker.js: retain main's new lineupEvidence import and add createReadCoalescer. Main's entire AI function was compared byte-for-byte and preserved. The backend delta against v9.13 is still only the existing public-read wrapper/import/call sites.

All other files merged automatically. No solver/UI redesign or production actions were performed. Main's home active-week selector, compact roster-driven reports and new chart destination remain intact. The home Points regression now expects Position Allocation. A new expanded Player Terminal regression checks click, Enter and Space each open Position Allocation.

## Checks

- 92 JS tests pass, 0 fail; 7 Python tests pass on the v9.13 integration.
- All 24 existing graph browser tests pass after the destination expectation update. The added Player Terminal destination regression passes separately (three activation methods), bringing covered graph cases to 25.
- All three keyboard scripts pass: verify-shortcuts.cjs; audit-shortcuts.cjs (30 report/layout combinations plus adversarial checks); verify-keyboard-gates.cjs.
- Additional local probe passes pending Graph, Free agents and Opportunity searches while help is open, Escape focus return, slash-to-search and G navigation, in both layouts (six combinations).
- Desktop 1440px and mobile 390px graph/help screenshots inspected; labels readable and no horizontal overflow. Chromium only; no real device, Safari, Firefox or assistive-technology claim.
- Logs retained in /tmp/fantasy-combined-913; earlier integration logs in /tmp/fantasy-combined-review. External browser requests were blocked; APIs used local fixtures. No production endpoint calls.

## Unresolved intermittent result

The first keyboard script run on the earlier combined candidate failed its metric-card Escape focus assertion (verify-shortcuts.cjs line 72). Instrumented rerun and two further normal runs passed. A 30-cycle metric focus probe also passed. The manager independently observed the same intermittent assertion on PR 2 alone; the keyboard owner is investigating. The v9.13 run passed, but this is NOT evidence that the intermittent cause is fixed. Preserve this candidate and rerun against any resulting keyboard update before claiming stable combined acceptance.

The initial custom help/debounce probe also made an invalid assumption: programmatic click does not focus its button, so native dialog return may correctly restore the still-live input. Explicitly focusing the help opener before activation resolves that test assumption; no product change was made for it.

This is an integration-review candidate, not approval to merge or deploy. Original PR branches remain intact. Earlier performance numbers remain historical measurements, not rebenchmarked v9.13 claims.

## Final UI compatibility gates

The complete graph/UI browser script passes **28/28**, 0 failed/skipped (35.45 seconds). It includes all earlier cases plus separate Complete Statistical File → Player Stat Archive coverage, header/Matchup/strategy active-week synchronization in both selector directions, and home AI button player routing without opening its parent tile. The AI test injects a demo fixture control and stubs generation; it verifies event handling only, with no provider calls. The expanded Matchup picker is correctly read from `#lab-match-week` in the heading; the old dark-chrome slot is intentionally empty in main.

No application fix was needed for these compatibility gates. The unresolved intermittent keyboard metric-focus result above remains explicitly open pending the keyboard owner's investigation.

## Non-demo AI and historical-week follow-up

New `scripts/check-integration-ai-browser.cjs`: **8/8 pass**, all real frontend handlers with local fictional non-demo data and intercepted API responses. No provider calls.

- Both global selectors synchronize; the expanded Matchup selector remains report-local and leaves global/strategy week unchanged.
- Missing historical matchup stays missing at home and does not inherit the current matchup's score in the expanded scoreboard.
- Home AI click, Enter and Space each make exactly one mocked POST, keep the parent tile closed, and show a disabled busy control. A duplicate invocation while busy adds no request.
- HTTP 502 error is visible, busy state clears, and retry makes one new request and displays its successful result.
- Held responses for a previous player or week do not appear under the changed player/week in either the home preview or expanded outlook.

The historical case initially failed: when model-level currentWeek/liveWeek metadata was absent, weeklyLineupData treated the selected historical week as the active week and borrowed currentMatchup.points. The narrow fix uses the matchup's recorded week before the global selection fallback and requires its week to match before using its official score. A valid current-week fixture still reports its official total. AI implementation was unchanged.

After this fix: 92 JS, 7 Python, 28 graph/UI browser cases, 8 non-demo AI/week browser cases and all three keyboard scripts pass. The earlier intermittent metric-focus caveat remains open pending keyboard-owner investigation; these passing reruns do not establish its cause.

## Separate viewport-focus candidate after pinned 7b5a0c0

Pinned review candidate `7b5a0c02c614defc551c42157ad06d43f22b655a` and its branch remain unchanged. New branch: `codex/combined-focus-review-20261022`.

Keyboard input `d5adc74cc71a6649c155c9dd55d058dad37c16b6` merged without conflicts at `842d83b629b00f7f73344ce5cb5b69eb1867530d`. It restores focus when queued scroll/resize dismisses a metric card only if that card still owns focus. Main remains `fe917d479086a11d994274b3bed6c30dfef70902`.

A separate graph reproduction then failed in two cases: directly focused home R² metric followed by resize, and an open R² metric card followed by resize. The keyboard handler restores the trigger, but the scheduled graph redraw replaces it, dropping focus to body. A moved-focus control case already passed.

The two-line graph fix captures the focused metric identity before replacing the home graph and restores the matching new metric only if the old node disconnected and focus is now body. It does not reclaim focus from a surviving outside control. All three regressions pass after the fix. No layout, graph semantics, preference, AI, cache, or solver changes were made.

Evidence is in /tmp/fantasy-focus-delta: before.log (two failures, one pass), after.log (three passes), full browser/node/Python/keyboard logs. The controlled viewport defects are reproduced and fixed; the original intermittent Escape occurrence is still not conclusively attributed to them. Do not describe that original occurrence as proven resolved solely from passing reruns.

Final delta checks: **92 JS + 7 Python**, **39 browser cases** (31 graph/UI including the three new focus cases + 8 non-demo AI/week), and **all four keyboard scripts** pass, including the new controlled queued-scroll/resize dismissal checks. No failures/skips in the Node/browser case counts. Desktop/mobile checks are included in the browser scripts; cross-browser/physical-device limits remain unchanged.
