# Keyboard shortcuts — October 22, 2026

Branch: `codex/keyboard-shortcuts`. Base: verified latest `origin/main` at
`74c137e48dfa1b83fb7621a162aacdfaf45195ef` (`git fetch origin main` succeeded).
Implementation: `0f5c9ada1cdecfed45b27bc07d65220b3684ba23`.

## Keymap

| Key | Action |
| --- | --- |
| G | Focus existing GO TO on dashboard/report. Use native arrows/Enter to select a destination. |
| / | Focus current report search when available (Free agents, Touches & share, Variable lab). Otherwise leave the key alone. |
| ? | Open keyboard help. |
| Escape | Dismiss the top card or native modal. Inline tabbed reports stay open. |
| Tab / Shift+Tab | Existing native control navigation. |
| Left/Right, Home/End in report tabs | Existing workspace tab navigation. |

KEYS ? buttons in the main menu and report title bar make help discoverable and
available on touch screens. Help uses existing chrome, a named/described native
dialog, initial close-button focus, and native focus restoration. Its checkbox
disables character shortcuts for this page visit; Escape/native controls remain
available. No storage writes or navigation label changes were added.

Character shortcuts ignore inputs, textareas, selects, editable regions, custom
textbox/combobox/slider roles, composition, legacy IME code 229, repeats, prevented
events, and Ctrl/Meta/Alt combinations. Shift is allowed only for `?`. Data/About/
help modals and metric cards suspend navigation shortcuts. Native selects retain
typeahead; no global arrows were added. Native report `cancel` also dismisses a
ranking card first when focus is in a form control.

## Audit and integration boundary

No AGENTS.md or .agents/skills files were present; /workspace/.agents was empty.
Read README, VERIFICATION, workspace tests, and keyboard/modal handlers in script,
explorer, interactions, strategy, and workspace.

Previously, report tabs supported arrows/Home/End; tiles/rows supported Enter/Space;
native dialogs handled Escape/focus return; metric cards consumed Escape in capture;
ranking cards supported pointer dismissal only. There was no global keymap/help.

Only public/index.html and new public/shortcuts.js change application code. The
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
  then run `node scripts/verify-shortcuts.cjs` with Playwright available and Chromium
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
were preserved. Shortcut opt-out intentionally lasts until reload. No outstanding
implementation blocker.
