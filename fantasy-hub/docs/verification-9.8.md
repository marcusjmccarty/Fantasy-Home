# v9.8 verification

- Historical range regression verifies that a week cannot use its own outcome, future outcomes, or the current ESPN projection. Provider projections remain unavailable where not supplied.
- Play-by-play unit tests cover sacks without targets, duplicate plays, missing EPA/yardage, correct denominators and prior-week filtering.
- AI route test verifies that the Worker resolves the real opponent, retrieves its correct offensive/defensive unit, ignores caller-supplied opponent statistics, preserves paragraph breaks, and requests a 2–3 paragraph analysis.
- Franchise selectors, active-roster/all-player leaders, D/ST terminology, shared homepage/full-report trade state and clearing incompatible partner picks are covered by report tests.
- Existing Cloudflare runtime, session security, lineup optimizer and tab navigation tests remain active.

Visual and interaction verification is recorded after the GitHub-connected build deploys.
