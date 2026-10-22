# Keyboard shortcuts — October 22, 2026

Branch: `codex/keyboard-shortcuts`. Base: verified latest `origin/main` at
`74c137e48dfa1b83fb7621a162aacdfaf45195ef` (`git fetch origin main` succeeded).
Initial implementation: `0f5c9ada1cdecfed45b27bc07d65220b3684ba23`.
Follow-up fixes: `3c53e74`, `ad16f86`, `afa820e`, `a209ec7`, `b23844c`.

## Keymap

| Key | Action |
| --- | --- |
| G | Focus GO TO in Windowed mode or the active report tab in Tabbed mode. Use existing arrow navigation. |
| / | Focus current report search when available (Free agents, Touches & share, Variable lab). Otherwise leave the key alone. |
| ? | Open keyboard help. |
| Escape | Dismiss the top card or native modal. Inline tabbed reports stay open. |
| Tab / Shift+Tab | Existing native control navigation. |
| Left/Right, Home/End in report tabs | Existing workspace tab navigation. |

KEYS ? buttons in the main menu and report title bar make help discoverable and
available on touch screens. Help uses existing chrome, a named/described native
dialog, initial close-button focus, and native focus restoration. Its checkbox
disables character shortcuts; Escape/native controls remain available. The choice
is remembered under `gridiron86-keyboard-shortcuts-v1`, only written on explicit
checkbox changes. Blocked storage falls back to a page-local choice. Workspace
storage and navigation labels are unchanged.

Character shortcuts ignore inputs, textareas, selects, editable regions, custom
textbox/combobox/slider roles, composition, legacy IME code 229, repeats, prevented
events, and Ctrl/Meta/Alt/AltGraph combinations. Shift is allowed only for `?`. Data/About/
help modals and metric cards suspend navigation shortcuts. Data/About allow ?
from non-editing controls; G and / remain suspended there. Native selects retain
typeahead; no global arrows were added. Native report `cancel` also dismisses a
ranking card first when focus is in a form control.

## Audit and integration boundary

No AGENTS.md or .agents/skills files were present; /workspace/.agents was empty.
Read README, VERIFICATION, workspace tests, and keyboard/modal handlers in script,
explorer, interactions, strategy, and workspace.

Previously, report tabs supported arrows/Home/End; tiles/rows supported Enter/Space;
native dialogs handled Escape/focus return; metric cards consumed Escape in capture;
ranking cards supported pointer dismissal only. There was no global keymap/help.

Application changes are public/index.html, new public/shortcuts.js, a small
modifier/composition guard on the existing interactions.js metric listener, and
a focus-ownership guard in the strategy.js usage-search debounce. The
module uses existing selects and `dismissRankHost`, after metric capture handling.
It does not change graph focus/reordering/redraw/mobile sizing, workspace preference
writes, tiles, or navigation labels. Parent owns integration. No push, merge,
deployment, credentials, live provider requests, or paid actions were performed.

## Verification

- `npm ci --cache /tmp/fantasy-shortcuts-npm --no-audit --no-fund` installed locked
  dependencies. Initial baseline tests lacked miniflare; install resolved that.
  The default npm cache was unwritable, so /tmp was used without escalation.
- `npm test`: **72/72 passed**, including local Cloudflare runtime tests.
- `node --check public/shortcuts.js` and `git diff --check`: passed.
- From fantasy-hub, serve with `python3 -m http.server 8765 --directory public`,
  then run `node scripts/verify-shortcuts.cjs`, `node scripts/audit-shortcuts.cjs`,
  and `node scripts/verify-keyboard-gates.cjs`
  with Playwright available and Chromium
  installed. Optional `CHROMIUM_PATH` and `SHORTCUTS_BASE_URL` override defaults
  `/usr/bin/chromium` and `http://127.0.0.1:8765`. Playwright is a QA-environment
  dependency, not an app dependency. External requests are blocked; API responses
  are stubbed. Screenshots are also written to /tmp/shortcuts-{desktop,mobile}.png.
- Chromium QA passed at 1440×1000 and 390×844, plus a touch-enabled mobile context:
  keyboard-only GO TO/report selection; repeated navigation; search; nested help;
  Tab focus isolation; Escape/focus return; help-over-ranking dismissal order;
  ranking cancellation from a form control; existing metric cards; input and
  contenteditable typing; select exclusions; modifiers, IME, repeat guards; opt-out
  and help recovery; tab arrows/Home/End; no page errors/mobile horizontal overflow.

Evidence: [desktop help](screenshots/shortcuts-desktop.png),
[touch mobile help](screenshots/shortcuts-mobile.png).

Limitations: Chromium/demo data and simulated composition events; not physical
mobile hardware, actual OS IMEs, native Safari/Firefox, screen-reader browse mode,
or live league connections. Existing Enter/Space handlers outside this module
were preserved. Renderer-owned focus issues below need coordination before editing.


## Deeper audit and next backlog

The additional browser script covers all 15 WORKSPACE_TABS destinations in both
Windowed and Tabbed modes (30 combinations): summary, matchup, roster, weekly,
standings, profile, player-analytics, agents, positions, position-compare,
league-contributions, outlook, opportunity, trade, graph. It exercises real select
or tab navigation, G, G then /, absent/present search, typing, help return focus,
and Escape. It also tests reload/re-enable, unchanged workspace storage, blocked
storage, help after a real renderExplorer update, held Escape, metric modifier/IME
exclusions, and AltGraph. All passed; original browser QA and 72 Node tests pass.

Five follow-up fixes were supported by failing cases before implementation:

1. `3c53e74`: G targeted a hidden select in Tabbed mode. It now focuses the active
   tab; existing workspace arrow navigation remains untouched.
2. `ad16f86`: disabling single keys reset on reload. Opt-out now persists separately
   from workspace state, supporting users whose assistive technology uses letters.
3. `afa820e`: removing a help opener with renderExplorer stranded focus on close.
   The close handler now falls back to the visible help button only when native
   focus restoration failed, and never steals focus from another modal/control.
4. `a209ec7`: held Escape dismissed help and then its report; metric capture also
   consumed Ctrl+Escape/composing events. Repeat Escape no longer cascades through
   native modals, and metric capture honors modifiers/composition/repeats.
5. `b23844c`: delayed Touches & share results reclaimed keyboard focus after a
   move to another control. The standalone callback now restores search selection
   only if search still owned focus before updating results. Browser tests cover
   both moved focus and continued typing.

Sequential G then / intentionally leaves Windowed GO TO focused: it is a select,
so native typing wins. In Tabbed mode G focuses a tab, and / then focuses report
search when available. Rapid character repeats cannot reopen help or route again.
Single-key opt-out remains available through the visible button without keyboard
shortcuts; actual screen-reader browse-mode testing is still needed.

Priority backlog requiring owner/environment coordination:

- **Renderer focus stealing (reproduced; no overlapping edit attempted):** in
  Tabbed Free agents and Variable lab, dispatch an input change
  in the search field then focus KEYS ? before the 170ms debounce expires. After
  300ms focus returns to agent-search / graph-search respectively.
  The callbacks unconditionally refocus after updating data. Targets:
  explorer.js input handler near line 2145 (agents and graph share one handler),
  Graph focus belongs to the performance task; coordinate ownership before edits.
  Touches & share was independently fixed in b23844c. Suggested
  behavior: restore selection only while the same search still owns focus.
- **Navigation coverage difference (observed; unchanged):** dashboard GO TO lacks
  position-compare and league-contributions, while report GO TO and tabs include
  them. All routes were audited through report controls. Site navigation is owned
  by the UI task/parent; no destinations were added or renamed here.
- **Cross-browser/assistive technology validation:** native Safari/Firefox,
  physical keyboards/IME, and screen-reader browse-mode opt-out require those
  environments. Chromium and synthetic events cannot establish that coverage.

No operations were denied and no outcome is uncertain. The renderer edit is
pending owner coordination, not a tool/permission rejection.

## Latest-main integration checkpoint

Prepared `codex/keyboard-shortcuts-integration` in a separate worktree on freshly
fetched main `e8eb5af937c4ab298713f815ee95c18633c86356` (newer than the supplied
8f6e87c checkpoint). Original branch remains intact at `761e87d`.

The eight original commits were cherry-picked locally. One conflict in index.html
script includes was resolved by retaining main's v9.12.1 versions and its new
interactions-before-explorer ordering, then loading shortcuts last. No graph or
workspace implementation was edited. Mapped integration commits:

| Original | Integration |
| --- | --- |
| 0f5c9ad | b332e1c |
| 51ec1e6 | 9da09b0 |
| 3c53e74 | 335a6ba |
| ad16f86 | 97f39f3 |
| afa820e | be63fc1 |
| a209ec7 | 1a0566e |
| b23844c | aaa415e |
| 761e87d | cc2d8dc |

Latest-main validation: **75/75 Node tests pass** (main added three tests), both
browser scripts pass with `SHORTCUTS_BASE_URL=http://127.0.0.1:8766`, and syntax/
whitespace checks pass. The audit additionally verifies nested metric/report
Escape: first Escape removes only the metric and restores its trigger; second
Escape closes the native report. Held Escape, help-over-ranking, and modifier/IME
guards pass with main's updated global listener order. Screenshots here were
refreshed on the integrated v9.12.1 build. No main checkout, push, merge, or deploy.


## Manager gate pass and refreshed handoff

Additional fixes on the integration branch:

- `ed8be29`: allow ? from non-editing Data/About controls while preserving report
  navigation suppression and input exclusions.
- `4788a52`: recover native help focus when the opener becomes hidden, inert,
  detached, or CSS-hidden. Prefer the help control, otherwise a usable control
  inside the remaining top modal/report. Never focus a background/inert control.
- `ac3d00e`: ignore a delayed usage-search callback if its input belongs to a
  previous report instance. Reproduction: type with caret 2, close/reopen the
  report, put the new caret at 0; the old callback formerly moved it to 2.

`verify-keyboard-gates.cjs` now independently covers player/summary/position
ranking overlays in both modes; help over report/Data/About; held Escape; usable
focus return for removed/hidden/inert/CSS-hidden openers; inert openers in Data/
About; same-report close/reopen; ten rapid layout cycles with queued close events;
exactly one workspace-open event for each Enter/Space activation; opt-out after G
and reload. G is a direct action: there is no pending multi-key sequence to cancel.

All three browser scripts passed on the integrated build. Node tests remain
75/75; syntax and whitespace checks pass. No changes to graph/free-agent handlers
or workspace persistence were made. Those shared renderer fixes remain assigned
to the performance owner. Actual OS IME/assistive-technology/Safari/Firefox tests
remain environment-limited, rather than claimed from synthetic Chromium tests.

The archive's MANIFEST.json records its exact base/head and per-file checksums;
SHA256SUMS includes the manifest. It contains the verified git bundle, this doc,
the three browser scripts, and four test logs. Library identity is retained when
refreshing the archive, so earlier verified candidates remain version history.


## Discoverability and accessibility review

Installed-runtime check found system Chromium only. Playwright Firefox/WebKit
executables and axe-core are absent; none were installed. Chromium accessibility
snapshots are evidence about the exposed tree, not physical screen-reader testing.

Verified and corrected:

- Disabled character shortcuts still advertised `?` in the help button and tooltip.
  Buttons now read KEYS while off, retain their enabled click/tap behavior, and
  expose the accessible name “Keyboard shortcuts (single-key shortcuts off)”.
  Enabled buttons retain KEYS ?. Both identify their controlled help dialog.
- The Tabbed footer exposed the old “ESC TO CLOSE” to accessibility APIs despite
  the visual CSS replacement. Its source text now accurately describes dismissal
  of cards/windows, alongside existing tab navigation guidance.
- Help's text-field exclusion is explicitly scoped to G, /, and ?, avoiding the
  implication that native Tab/Escape stop working in inputs.

No new shortcuts were added. Optional aria-keyshortcuts metadata was considered
but not added: shortcut availability is conditional on focus, modal, layout and
opt-out state, and no assistive-technology runtime is available to validate such
announcements. Explicit accessible button names and aria-controls are verified.

The gate script now checks accessible button names/control relationships,
continued help availability while disabled, restored off-state after reload, and
absence of contradictory close guidance in the Tabbed accessibility tree. All
three browser scripts and 75 Node tests pass after these changes.

User keymap: **G** → GO TO/current tab; **/** → available report search;
**?** → help; **Escape** → top card/window. Native Tab and report-tab arrows stay
unchanged. Character shortcuts can be disabled persistently in help.

Remaining release gate: run all three keyboard scripts against the performance
owner's exact combined candidate, especially shared debounce and Escape ordering,
and record that candidate's full SHA. No more independent keyboard changes are
planned until that feedback arrives. Native Safari/Firefox, physical IME and
screen-reader verification remain explicitly unperformed environmental checks.
