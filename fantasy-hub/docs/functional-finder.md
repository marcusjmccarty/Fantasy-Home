# Functional finder: first vertical slice

Base: f447a3dbf7c9dcdac7ff4eb8907f241dda5d2a31. Recovery input:
1ba2edccc61f1ccd44adee798c7ae4578058895c, preserved on
codex/keyboard-redesign-recovery-wip. Successor: codex/functional-player-search.
Recovery was cherry-picked onto latest main; the asset conflict retained 9.14.1.
No AGENTS.md or .agents/skills instructions were present in this environment.

## Functional map

- G / FIND GO: searchable reports, Enter opens.
- /: search all loaded players; in Trade the explicitly labeled Team A package
  is initially selected and the scope selector offers Team B or all players.
- Arrow keys select results; Enter opens a player file or toggles the selected
  trade-side checkbox through its existing handler. No package-size restriction.
- Player actions expose game logs and position peers. Inspect Week shows recorded
  points and provider projections separately, with unavailable values explicit.
- Escape cancels finder; report Back/Forward retains finder-origin focus and scroll.
  Finder query, result index and inspection week remain in page memory.
- ? opens help; persistent character-key opt-out leaves clickable controls usable.
- Prototype bracket keys removed. Existing browser/OS modifiers are not intercepted.

Search covers loaded data only, including loaded free agents. It neither fetches
additional player pages nor submits any real transaction. Weekly inspection is
local to finder; the report's existing week remains unchanged. Position comparison
opens a peer report, not a two-player comparison or a trade recommendation.

## Measured baseline and first demo

Chromium, deterministic exhibition data, local static server; external requests
blocked and API status mocked. Current-main baseline tested home plus all 15 report
routes: home / focuses home-fa-search; only opportunity, agents and graph have
report search. 12/15 reports retain unchanged focus. No published redesign existed
when recovery began; the recovery ref was fetched after publication.

Candidate: 30/30 report/layout combinations open finder. In both layouts, search a
free agent (disambiguating duplicated names by Free agent label), inspect Week 3,
open file, Back, reopen finder: query, highlight, inspected week, report week and
focus are asserted. Three Team A players plus one Team B player are selected via
Enter; package counts and Escape focus return are asserted. No trade math changes.

Task operation accounting (query entry counted as one operation, not individual
characters; these are interaction counts, not latency or a usability study):

| Task | Baseline direct shortcut workflow | Candidate |
| --- | --- | --- |
| Open a rostered player's file from Roster | / has no action | / + type unique name + Enter: 3 operations |
| Inspect weekly values in finder | No surface | / + type name + choose week: 3 operations |
| Add known player to current Trade A package | / has no action | / + type name + Enter: 3 operations |
| Return from inspected file to report | Existing Back | Back: 1 operation; reopening finder restores search |

The existing manual routes remain possible; their full Tab/click counts were not
measured, so no claimed percentage effort reduction is justified.

## Checks and limits

- npm test: 97 passed, zero failed.
- node scripts/verify-finder.cjs: 30 report/layout entries, two weekly-return
  workflows, two three-for-one packages, modifier/composition guard, opt-out and
  clickable recovery; zero page errors. Desktop 1440x1000 and mobile 390x844
  screenshots inspected; finder has no horizontal overflow.
- node scripts/verify-metric-dismissal.cjs: queued scroll/resize focus cases pass.
- Syntax and git diff --check pass.
- Existing verify-shortcuts/audit-shortcuts/verify-keyboard-gates scripts encode
  the previous G-focus and slash-local-search map and still need migration before
  this draft is ready. No claim of full browser regression completion.
- Actual OS IME, screen readers, Firefox/Safari, live providers and changed league
  data while finder is open are not validated. Manager acceptance review pending.
- No graph/sort/debounce/workspace/trade math changes. No merge or deployment.

Screenshots: [desktop](screenshots/finder-desktop.png),
[phone](screenshots/finder-mobile.png).

## Main drift integration

Main advanced during draft publication to 1d98cdccb4677a53cbd28ecb35dc9537b1a4549d
(the separate agent-sort PR #4 merge). Merged main into this successor branch,
with no edits to that owner's code. Repeated the functional browser demo: all
30 entries and both complete workflows pass. Node suite: 102 passed, zero failed.
This integration is only on the feature branch; main was not written.
