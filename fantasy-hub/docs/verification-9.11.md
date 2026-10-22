# v9.11.1 verification

## Automated checks

- Full suite: 72 Node tests and 7 Python tests passed.
- After versioning browser and worker assets: all 30 strategy/workspace tests passed again.
- JavaScript syntax checks and `git diff --check` passed.
- Exact lineup assignment matches exhaustive assignments over mixed and incomplete rosters. Custom ESPN slot counts, provider eligibility, 14-player starting lineups, bench/IR exclusion, and unavailable settings are covered.
- Trade search matches an independent exhaustive package/drop search on small fixtures. A 17-player roster pair checks all 23,409 one- and two-player combinations (roughly 0.55–0.65 seconds on the development host).
- Team selectors leave the active franchise unchanged; stale worker results cannot replace a newer search. Package edits reuse the same search results.

## Live browser checks

Tested the published site in exhibition mode at 1280 × 800, 1920 × 1080, and 390 × 844, including Windowed and Tabbed views.

- White and black title ornaments both measure 13 × 13 pixels. Matchup week selection is in its title banner; the original competitor/score arrangement sits above the roster lists.
- Windowed reports measure 1203 × 776 at 1280 × 800 (38px side margins, 12px vertical margins). Mobile reports leave 12px side and 8px vertical margins; neither the page nor report content overflows horizontally.
- Player Points and Share headers both have top/bottom rules and use W1–W6 labels. Share bars open the matching week and player; the heading selects season totals.
- Variable Lab labels use font weight 700. Opening a graph statistic leaves the SVG's measured dimensions unchanged and opens upward. The card covers its trigger and closes with one click.
- The Touches explanation leaves the metrics grid exactly 88px tall on desktop. Mobile cards stay within the viewport. Outlook metric explanations open successfully.
- Original ranking expansions cover their complete trigger width (310px popup over a 304px tile at 1920px).
- Weekly Production immediately measures 1155px in its 1155px host; the wide Tabbed view measures 1836px in its 1836px host.
- Weekly Contribution bars have a visible 2px blue focus outline and 3px halo. Keyboard activation of Week 3 opens the Week 03 starting-lineup table.
- Fourth & Forever / End Zone Theory produces six mutual improvements from 6,084 combinations. Applying a recommendation populates both packages, shows 99% balance, and reproduces positive modeled lineup gains for both teams. Full roster lists have no internal vertical scrolling.
- No browser console errors during these checks. Versioned script, style, worker, and worker-import URLs prevent cached releases from being mixed.

The live checks use synthetic exhibition data; ESPN custom format/eligibility behavior is verified with fixtures. Recommendations represent modeled weekly scoring gains, with explicit bench drops for unequal packages, not guaranteed trade outcomes.

## Screenshots

- [Trade desk](screenshots/v9.11-trade-desktop.png)
- [Automatic recommendations](screenshots/v9.11-trade-recommendations.png)
- [Floating graph explanation](screenshots/v9.11-variable-card.png)
