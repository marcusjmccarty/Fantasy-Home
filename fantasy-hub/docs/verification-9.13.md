# GRIDIRON/86 v9.13.0 verification

Verified on the published Cloudflare site, October 22, 2026.

## Automated checks

- 80 Node tests and 7 Python tests passed.
- JavaScript syntax and git whitespace checks passed.
- Regression coverage includes bidirectional active-week selection, historical projection isolation, prior-week quick stats, roster-controlled home reports, three home metrics versus eight expanded metrics, and sanitized lineup evidence supplied to the AI analysis prompt.

## Live interaction and layout checks

- Desktop widths: 1280 and 1920 pixels. Phone: 390 × 844.
- Main Active Week and home Matchup selectors remain synchronized in both directions. Selecting Week 3 updates Outlook and the Player Terminal quick stats to Week 3, Week 2, and the preceding recorded-game average.
- Personnel Register selection updates both home Outlook and Share. Neither home report contains a franchise or player selector.
- The bottom row measured 366px tall at 1280px with Josh Allen selected. Report heights can vary with content and viewport width.
- Home Share shows three white metric cards; expanded and tabbed Share retain eight. Receiver share bars omit Carry share when the player has no rushing attempts.
- Home and expanded Player Terminal quick stats are white with separate colored top borders.
- Points chart surfaces open Position Allocation in both home and expanded views. A Week 3 points bar opens Club Overview with Starting Lineup set to Week 3. The Starting Lineup subtitle measures 20px.
- Matchup score ribbon is dark, with team names and records above the large scores. The week value is visible.
- Home trade player selection updates values, difference, balance, and package favor without opening another window. Team B uses red on the favor track. The sample McCaffrey / Avery Knight trade shows 19.3 versus 12.4, -6.9 difference, 64% balance, and 39% / 61% favor.
- Tabbed Player Outlook and Touches & Share render correctly after switching from Windowed mode.
- Phone document width equals the 390px viewport; no horizontal overflow was observed.
- No browser console errors were observed.

The live checks used the synthetic exhibition dataset. Live ESPN ingestion and a production AI generation were not exercised. The analysis request and prompt were tested with fixtures; demo summaries are labeled Exhibition Outlook rather than AI output.

## Screenshots

- [Compact home reports](screenshots/v9.13-home-reports.png)
- [Matchup and Player Terminal](screenshots/v9.13-matchup-player.png)
- [Mobile reports](screenshots/v9.13-mobile.png)
