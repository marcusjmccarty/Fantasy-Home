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
