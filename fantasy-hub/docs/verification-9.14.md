# GRIDIRON/86 v9.14.1 verification

Verified on the published site, October 22, 2026.

## Automated validation

- Initial feature build: 84 Node tests and 7 Python tests passed.
- After merging the concurrent keyboard/graph release: all 96 Node tests passed, including the added public-read and runtime coverage.
- Final explicit exhibition-slot correction: all 36 focused strategy/refinement tests passed, including a new regression for QB, RB, RB, WR, WR, TE, FLEX, D/ST, K order.
- JavaScript syntax and git whitespace checks passed.
- Fixtures verify slot sorting, numeric week labels, Outlook routes, loaded opponent-defense identity, visible TD methodology, empty balance rendering, and removal of redundant player-file navigation.

## Published browser checks

- Version 9.14.1 is visible in the status bar. Main week selector displays `06`.
- Matchup title ribbon is gray; the score ribbon remains dark. The gap between title and score is 2px. The roster and tile interior both measure 581px at a 1600px viewport.
- The nine-starter exhibition opponent displays QB, RB, RB, WR, WR, TE, FLEX, D/ST, K. Trade roster uses the same sequence, followed by bench players.
- Position Allocation has three white summary tiles. Clicking Starter Points opens its metric explanation without opening the expanded report. Faint vertical divisions span the allocation tracks.
- Complete Fantasy Game Log, Player Snapshot, Starting Lineup, and Variable Lab subtitles measure 13px bold Courier. Expanded Player Terminal retains its original six ranking tiles and omits the extra quick-stat row.
- Prior Scoring opens the selected player's Statistical Archive. Projected Scoring Range opens Player Terminal; its nested Estimated Floor tile still opens an explanation independently.
- A trade ribbon double-click opens the correct Player Terminal. Returning to Trade shows no accidental selection change from the double-click. Clicking the partner's roster heading opens that partner's Club Overview.
- TD estimate, metric definitions and coverage render as a visible section, with no disclosure control.
- Variable Lab metric cards are white in home and tabbed views. The merged keyboard reference controls remain present.
- Window arrows measure 24px square; Close measures 70 × 26px.
- Empty home Trade displays the balance circle, zero package totals, and no placeholder dashes. Selecting the sample packages updates it to 64% balance and -6.9 points difference.
- Phone viewport 390 × 844 has no horizontal page overflow. No console errors observed.

Live interaction checks used the exhibition dataset. Opponent-defense archive routing was verified with a loaded-defense fixture; a live ESPN credential session was not exercised.

## Screenshots

- [Matchup and allocation](screenshots/v9.14-matchup-allocation.png)
- [Empty trade instrument and home reports](screenshots/v9.14-home-trade.png)
- [Mobile trade with selected packages](screenshots/v9.14-mobile-trade.png)

The release preserves the concurrent graph performance, public-read coalescing, and keyboard shortcut work merged in commit 41c2008.
