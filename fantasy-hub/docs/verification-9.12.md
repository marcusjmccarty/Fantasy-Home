# GRIDIRON/86 v9.12.1 verification

Verified on the published Cloudflare site, October 22, 2026.

## Automated checks

- 75 Node tests and 7 Python tests passed.
- 35 focused navigation, strategy and refinement tests passed after the final alignment changes.
- JavaScript syntax and git whitespace checks passed.
- New regression coverage checks nine-tile popup anchoring (including the middle tile), viewport bounds, starter-only matchup rows, receiver/QB workload applicability, and week-versus-season Share navigation.

## Live interaction and layout checks

- Desktop widths: 1280 and 1920 pixels. Phone: 390 × 844.
- All three strategy homepage tiles open from content surfaces. Nested selectors, metric explanations and trade package controls remain independent.
- Variable Lab homepage metric explanations open in place, upward, and close on another click. The rightmost card stays aligned to the trigger’s right edge.
- Player Points chart background opens the player’s complete scoring log. A Week 2 bar opens Week 2 Starting Lineup.
- Share chart background opens the selected player’s season report. A Week 3 bar opens that player with period Week 3.
- Expanded Points and Share plots measured identical width, height, and bottom edge: 268.796875 × 295.59375 at the 1280-pixel viewport. Homepage plot baselines also match.
- Club Overview ledger/right-panel split exactly matches the fourth/fifth stat-tile split in Tabbed view (840.6640625 / 847.6640625 at 1280 pixels).
- Home matchup displays all supplied starters (6 and 9 in the synthetic fixture) with no inner scrolling or bench rows. Larger expanded matchup and lineup text measures 14px.
- Receiver check: Ja’Marr Chase displays Inside-5 targets and excludes Carry share. Receivers with recorded carries retain rushing metrics.
- Phone document and expanded strategy content have no horizontal overflow. Window measures 366 × 828 within a 390 × 844 viewport, retaining dismissible margins. TD chance stays on one line.
- No browser console errors observed during the checks.

The live UI checks used the site’s synthetic exhibition dataset; actual ESPN account data was not modified.

## Screenshots

- [Player Terminal](screenshots/v9.12-player-charts.png)
- [Dashboard](screenshots/v9.12-dashboard.png)
