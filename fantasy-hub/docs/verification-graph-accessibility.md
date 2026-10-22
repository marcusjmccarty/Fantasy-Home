# Graph accessibility and rendering verification

Base: `74c137e48dfa1b83fb7621a162aacdfaf45195ef` (v9.11.1).
Local branch: `codex/graph-accessibility-performance`. No publication or deployment.

## Behavior changed

- Point hover/focus paints a noninteractive, aria-hidden overlay instead of moving focusable SVG groups. Tab order remains stable, Enter/Space opens the selected player, and a necessary resize redraw restores the same point's focus without scrolling.
- Narrow reports provide a 260px plot and grow vertically. Short/tablet layouts preserve intrinsic report height and at least a 180px plot, so labels and statistics do not shrink or overlap the export section. The existing design, controls, axes, and data semantics remain.
- Graph mounting and ResizeObserver share one animation-frame scheduler. Matching rounded dimensions skip replacement; changing reports cancels pending paint work. Opening and filtering now construct one SVG rather than three.
- Tabbed resize skips the hidden home graph. Returning to Windowed layout refreshes the home graph with current data and dimensions.
- Synchronizing the current tab no longer writes an unchanged preference. Selecting another tab still persists it.

## Validation

- `npm test`: **73 passed**, including Miniflare and a new workspace persistence regression.
- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s test -p test_usage.py`: **7 passed**.
- Browser suite: **9 passed**. The original six acceptance checks failed on the base revision. Additional coverage checks sequential keyboard navigation, noninteractive hover overlay, short viewports, empty data, and rapid navigation.
- `node --check public/explorer.js`, `node --check public/workspace.js`, and `git diff --check`: passed.
- Chromium desktop/mobile screenshots inspected. Both Windowed and Tabbed checked at 320, 390, 650, 730, 731, 960, 1280, and 1920px widths. No horizontal page/report overflow; labels render at approximately 13px, previously 7.05px on a 390px tabbed viewport. Plot, statistics and export section remain separated.
- 960×540 checks the layout viewport equivalent of 1920×1080 at 200% browser zoom, not native browser UI zoom. No physical-device, Safari or Firefox verification.
- Extra browser checks: labels/trend toggles, WR filter, no-result search, hover, Tab/Shift+Tab/Enter/Space, metric popover without plot resizing, and rapid graph/weekly/summary transitions. No page errors recorded.

Run browser checks with a local static demo server:

```sh
python3 -m http.server 8766 --bind 127.0.0.1 --directory public
# Separate shell, with Playwright installed:
node --test scripts/check-graph-browser.cjs
# Or set PLAYWRIGHT_MODULE to an existing Playwright package directory.
```

The browser suite uses Chromium at `/usr/bin/chromium`, intercepts API reads with inactive/disabled fixtures, and blocks external or non-GET requests. It never contacts production services. Playwright is an optional development tool and is not added to the deployment dependencies.

## Comparable local measurements

Linux AMD EPYC cloud host; Node 24.19.0; headless Chromium 154.0.8037.57; 1440×1000 desktop demo. Three alternating base/branch browser runs with fresh browser contexts. Each run performs 12 Overview→Variable Lab transitions using the 36-point WR subset; first two excluded, leaving 30 measured transitions per revision. All-player opening uses 107 points.

| Measurement | Base | Branch |
| --- | ---: | ---: |
| SVG constructions per opening | 3 in all runs | 1 in all runs |
| Unchanged preference writes per tabbed resize | 1 | 0 |
| Hidden home chart redraws per tabbed resize | 1 | 0 |
| Median synchronous navigation | 10.10 ms | 8.70 ms |
| Median time to second animation frame | 17.90 ms | 13.85 ms |
| Median first `detailGraph` call, three runs | 20.00 ms | 20.20 ms |
| Median WR filter `detailGraph`, three runs | 8.30 ms | 7.90 ms |

Navigation measurements include instrumentation and local browser scheduling. They are not INP, final paint timestamps or production network latency. Initial synchronous opening did not improve measurably; the reliable gains are eliminated duplicate work and corrected interactions.

The unchanged analytics benchmark (19 counteroffers, 20 players, 10 starters; 3 warmups, 9 samples per process) returned branch medians **2.68 / 2.72 / 2.69 ms**, versus base **2.67 / 2.79 / 2.96 ms**, checksum **323.866667** throughout. No solver change or attributable analytics improvement is claimed.

## Integration notes

Each fix is separately committed. Integration order:

1. `1b3a10d` stable point order/focus and initial browser regressions.
2. `b85e8b8` mobile chart sizing.
3. `d98a2bd` coalesced rendering/cancelled stale frames.
4. `cdecea2` preference persistence guard and unit regression.
5. `d845aa3` hidden home resize and dashboard refresh.
6. `e5bf4cb` short-viewport intrinsic sizing and expanded browser coverage.

Touchpoints: `public/explorer.js` (`setExplorer`, `detailGraph`, `fitGraphScreen`, resize handler); `public/refinements.css` (graph selectors only); `public/workspace.js` (`syncWorkspaceTab`, `setWorkspaceLayout`); workspace/browser tests. Coordinate `workspace.js` changes with keyboard-routing work. Coordinate graph CSS and the explorer lifecycle with the active UI revision; home tile click handlers, Weekly Points/Share links, trade layout and shortcut routing are intentionally untouched.

Remote main was rechecked after implementation and still matched the base. Active unpublished UI work can nevertheless overlap these files. Recheck remote and rerun tests at integration time; apply commits in order and resolve overlapping lifecycle/CSS edits rather than overwriting the newer UI. Asset release versions are deliberately unchanged; version URLs together with the next integrated release.
