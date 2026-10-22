# v9.8 verification

- Historical range regression verifies that a week cannot use its own outcome, future outcomes, or the current ESPN projection. Provider projections remain unavailable where not supplied.
- Play-by-play unit tests cover sacks without targets, duplicate plays, missing EPA/yardage, correct denominators and prior-week filtering.
- AI route test verifies that the Worker resolves the real opponent, retrieves its correct offensive/defensive unit, ignores caller-supplied opponent statistics, preserves paragraph breaks, and requests a 2–3 paragraph analysis.
- Franchise selectors, active-roster/all-player leaders, D/ST terminology, shared homepage/full-report trade state and clearing incompatible partner picks are covered by report tests.
- Existing Cloudflare runtime, session security, lineup optimizer and tab navigation tests remain active.

Production browser checks (v9.8):

- 1920px desktop width: 1908px content; new row column starts 19 / 608 / 1323px, exactly matching the first row; no horizontal overflow.
- 390px viewport: cards stack at 362px; tabbed opportunity report contains its table overflow without widening the document.
- Homepage trade: James Cook for Avery Knight 1 yields 13.2 sent / 11.5 received / -1.7 difference. Changing partner clears incoming selections; clearing removes both packages.
- Single click on a non-name cell selected Christian McCaffrey in Player Snapshot and marked the whole row. Double-click opened Player Terminal; Scouting File opened Player Outlook. Range metric explanations opened and closed.
- Franchise 2 restricted the player selector to its 12 roster members. Opportunity Leaders switched from 6 matched active-roster records to 90 exhibition records.
- D/ST selection labeled the matchup Opposing Offense and used sacks conceded rather than defensive sacks generated.
- Browser console: no JavaScript errors during those flows.
- Production Gemini endpoint returned a three-paragraph Derrick Henry vs Cincinnati report using the verified opponent and NFLverse efficiency metrics.
- 43 JavaScript tests and 6 Python aggregation tests pass. Historical ranges are reconstructed estimates, not stored pregame forecasts.
