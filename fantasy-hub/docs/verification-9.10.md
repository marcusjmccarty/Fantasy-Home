# GRIDIRON/86 v9.10 refinement verification

## Automated checks

- 65 JavaScript tests pass, including Cloudflare runtime integration, plus 7 Python usage-data tests.
- Added coverage for week-specific workload aggregation, future-week exclusion, direct Share-bar routing, chart whitespace, collision-limited labels, measured graph dimensions, position-week totals and missing/zero/negative values.
- Trade percentage tests distinguish package value share from lineup improvement, including missing and zero baselines. Existing lineup optimization and counteroffer tests still pass.
- Franchise-filter changes preserve the selected player when the new scope includes that player, and choose a valid replacement otherwise.

## Live interaction and layout checks

Checked the deployed site using its explicitly synthetic exhibition league. No league transactions were made.

- At 1280 × 720, the Variable Lab plot is approximately 308 px high; at 1920 × 1080 it grows to 648 px. Tabbed mode at the larger viewport gives the plot 505 px. The statistical strip follows the plot without an empty gap; enrichment tools remain in a closed disclosure below the graph stage.
- Sparse labels show 8 names among 107 points at the default viewport. Focusing a previously unlabelled dot reveals its name; the same CSS rule handles pointer hover. Legend text is 12 px.
- Clicking a Share-chart value label leaves the Player Terminal open. Clicking the actual Week 4 bar opens that player's Touches & Share report with Week 4 selected. Week 3 was also checked.
- Clicking a Weekly Contribution value leaves its report open; clicking its colored bar opens the franchise scoring report.
- Touches & Share renders 8 metric cards and 8 share bars, with native expandable definitions. A metric and a share definition can be open together. At 390 × 844, the document stays 390 px wide and the report's content and scroll widths both remain 358 px.
- Position Allocation's Week 2 picker shows the recorded weekly position totals, including 31.6 QB and 22.2 RB points. The matchup's two 226 px roster panes contain 9 and 12 exhibition players and scroll independently.
- Trading James Cook for Avery Knight 1 shows 87% package balance, 47% / 53% package value shares, and -1.2% / +1.6% modeled lineup changes (-1.7 / +1.7 points per week). These are value comparisons, not acceptance or win probabilities.
- Trade search survives selecting and deselecting a player. Optional drops keep both their nested disclosure and parent lineup section open after recalculation. Balancing suggestions return an explicit empty result when no single addition improves the deal.
- Mobile trade layout has no horizontal overflow. Navigation retains square back/forward buttons and a rectangular close control, with sufficient title spacing.
- No browser JavaScript errors were recorded during these checks.

## Screenshots

- [Trade Calculator](screenshots/v9.10-trade-desktop.jpg)
- [Expanded Variable Lab](screenshots/v9.10-variable-lab.jpg)
- [Dashboard matchup and position controls](screenshots/v9.10-home-rosters.jpg)

Live checks cover exhibition behavior and responsive layout. Existing automated provider tests cover data boundaries; this pass did not import or transact against a private league.
