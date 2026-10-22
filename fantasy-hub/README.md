# Fantasy Hub — GRIDIRON/86 v9.13.0, Cloudflare edition

Live site: https://fantasy-home.fantasy-hub.workers.dev/

The existing v9.6 website now has a JavaScript Cloudflare bridge. Your computer does not need to stay running. Website assets and `/api/*` share one hostname, avoiding separate bridge hosting and CORS configuration.

## 1. Upload to GitHub

1. Unzip the bundle and open `fantasy-hub`.
2. Sign into GitHub → **+ → New repository** → name it `fantasy-hub` → **Create repository**. Public or private is fine.
3. Click **uploading an existing file** (or **Add file → Upload files**).
4. Drag the **contents** of `fantasy-hub` into the upload area: `public/`, `src/`, `test/`, `package.json`, `package-lock.json`, `wrangler.jsonc`, `.gitignore`, and documentation. Finder's Command–Shift–Period reveals hidden files.
5. Click **Commit changes**. This saves the source in GitHub. Do not upload the ZIP, `node_modules`, `.wrangler`, `.env`, `.dev.vars`, cookies or API keys.
6. Confirm `wrangler.jsonc` and `package.json` are at the repository root, alongside `public/` and `src/`, without an extra outer folder.

For an existing repo, replace the old website with this layout on its production branch. Remove obsolete `wrangler.toml` or conflicting Wrangler configs. Remove old deploy arguments such as `--assets ./`. Only `public/` should be exposed as website assets.

## 2. Connect Cloudflare

Use a **Worker**, with the complete project, not a static-only Pages upload.

1. Cloudflare → **Workers & Pages → fantasy-hub** (your existing Worker).
2. Find **Settings → Build**, **Builds**, or its Git repository connection area. Connect GitHub and authorize access to this repository.
3. Select the repository and production branch, usually `main`.
4. Set the following:

| Setting | Value |
| --- | --- |
| Root directory | `fantasy-hub` for the Fantasy-Home repository |
| Build command | `npm test` |
| Deploy command | `npx wrangler deploy` |
| Worker name | `fantasy-home` |
| Assets directory | Already configured as `./public` |

5. Save and deploy. If needed, use **Retry build** or push a README change to trigger the first build. Cloudflare installs dependencies from the package files. No frontend compilation or `dist` folder is needed.
6. The included migration creates the `ESPN_SESSIONS` Durable Object binding automatically. No KV, D1, database ID, or shared ESPN secret needs manual setup.
7. Open the Worker URL. Later commits to the production branch deploy automatically.

If creating a new Worker, use **Workers & Pages → Create application / Create Worker → Import a repository**, choose this repo, and use the same settings. Labels vary; select the Git-connected Worker flow that runs Wrangler. If the name already exists, update that Worker or change the name in **both** the dashboard and `wrangler.jsonc`.

## 3. Connect ESPN

1. Open the deployed HTTPS website. The existing demo should load.
2. Open league connection → **ESPN**. Enter league ID and season. The ID is the number after `leagueId=` in an ESPN league URL.
3. Public league: try both cookie fields blank.
4. Private league: log into ESPN in a browser with an account that can view the league. Open developer tools. Chrome/Edge: **Application → Storage → Cookies**. Safari: enable web developer features, then **Develop → Show Web Inspector → Storage → Cookies**.
5. Find `SWID` and `espn_s2` under ESPN's domains. Copy each **value only**, without `SWID=`, `espn_s2=`, semicolons or cookie attributes. Retain SWID's braces if present.
6. Paste the values into the matching site fields and click **CONNECT**. Allow time for the weekly box scores to load.
7. Each friend connects with their own league and authorized ESPN cookies. Do not configure one owner's cookies for everyone.

Each browser receives a random HttpOnly session cookie. ESPN credentials stay in a separate Cloudflare Durable Object for up to three hours and are deleted on expiry or **CLEAR PRIVATE SESSION**. This is temporary Cloudflare server storage, **not RAM-only**, unlike the old Python bridge. Closing a tab does not immediately delete it. Credentials are never returned in JSON, put in URLs, saved in browser storage, or logged by this code. Observability is disabled. Do not enable request-header/body logging when debugging.

Reloading restores the demo as in the original site. To reload ESPN data, open ESPN connection and click CONNECT again; during an active session, cookie fields can remain blank. Clearing a private session deletes server credentials but does not erase scores already displayed in the open page.

## 4. Test the deployed site

- Open `https://YOUR-WORKER-HOST/api/health`: expect `ok: true`, `bridge: "cloudflare-worker"`.
- Open `/api/espn/session`: expect `active: false` before connecting, `active: true` afterward, without ESPN cookie values.
- Connect a known league. Compare league name, standings, teams, rosters, matchup scores and weekly player scores with ESPN.
- Open Player Pool, load available players and D/ST, change position filters, inspect a player game log and weekly chart. Missing upstream data should stay missing.
- Load advanced stats and check season/source. An unpublished nflverse season may be unavailable; existing CSV import remains available.
- Open player editorial news. Some athlete feeds return no verified articles; empty results are valid.
- Verify Sleeper and JSON import still work.
- Open a private/incognito window. It must show no active ESPN session while your first window is connected. Connect a second league there if desired.
- Clear the first window's session. Its session endpoint should return false; the other window should stay connected.
- Repeat the Position Analytics filters on desktop, phone, and Safari. v9.6's existing mounted-control and pagination fixes are retained.

No private ESPN credentials were used during construction. Automated tests use fictional fixtures. A local build cannot prove ESPN accepts Cloudflare-origin requests; if ESPN blocks its IPs, the site will report that failure.

## 5. Local preview or direct deployment

Install a supported Node.js LTS release, then open Terminal in this project folder:

```sh
npm ci
npm test
npm run dev
```

Open the local URL Wrangler prints, normally `http://localhost:8787`. Local sessions are separate from production. Never commit `.wrangler/`.

To deploy directly instead of using GitHub builds:

```sh
npx wrangler login
npm run deploy
```

Wrangler opens Cloudflare login in your browser. No Cloudflare token belongs in this repository. For packaging validation without publishing:

```sh
npx wrangler deploy --dry-run
```

## Routing and configuration

`wrangler.jsonc` includes the Worker entry point `src/worker.js`, the `ASSETS` binding for `public/`, `run_worker_first: ["/api/*"]`, `workers_dev: true`, and the `ESPN_SESSIONS` binding plus SQLite migration. Leave the migration in place after deployment.

No additional route pattern is required for workers.dev. All frontend requests use `/api/...` relative to the current hostname. Do not replace these with localhost or a separate API URL. Cross-origin requests are intentionally rejected; no wildcard CORS header is needed.

| Method | Endpoint | Function |
| --- | --- | --- |
| GET | `/api/health` | Bridge health |
| GET | `/api/espn/session` | Session status |
| POST | `/api/espn/league` | League and weekly boxscore import |
| POST | `/api/espn/logout` | Credential deletion |
| GET | `/api/espn/free-agents` | Available players, D/ST and previous-week scores |
| GET | `/api/espn/player-overview` | Verified athlete editorial overview |
| GET | `/api/espn/news` | Fantasy feed compatibility |
| GET | `/api/nfl/game-status` | NFL game states and opponents |
| GET | `/api/nfl/matchup-strength` | Previous completed games' NFL points scored/allowed |
| GET | `/api/nflverse/advanced` | Public regular-season player stats |
| GET | `/api/ai/status` | Optional AI availability |
| POST | `/api/ai/outlook` | Optional generated commentary |

## Remove your name from the URL

Renaming the Worker changes only the first part of `fantasy-hub.ACCOUNT.workers.dev`.

For a free neutral URL, find your account's **workers.dev subdomain** settings in the **Workers & Pages overview** and edit `marcus-j-mccarty` to an available neutral name. This is an account-wide change affecting other workers.dev addresses in that account. Share the new URL afterward. Existing browser sessions on the old hostname do not transfer.

For a domain you own, attach a **Custom Domain** in the Worker's **Settings → Domains & Routes**. In a Wrangler-managed project also add your real domain to `wrangler.jsonc`, for example:

```json
"routes": [{"pattern": "fantasy.your-real-domain.com", "custom_domain": true}]
```

Replace the example with a domain in your Cloudflare account. Keep `workers_dev: true` if you want both addresses. Domain purchase is optional.

## Optional AI outlook — skip for the simplest launch

League stats, charts and ESPN editorial news need no AI key. AI generation defaults off. Both Gemini and OpenAI integrations from the Python project are ported. Gemini is enabled on the current deployment with a Cloudflare secret; live generation was verified.

In **Worker Settings → Variables and Secrets**, add one **secret**: `GEMINI_API_KEY` or `OPENAI_API_KEY`. Deploy/apply the change when prompted. Alternatively:

```sh
npx wrangler secret put GEMINI_API_KEY
```

Paste the key at the prompt. For OpenAI substitute `OPENAI_API_KEY`. Never put API keys in the frontend, GitHub or Wrangler config.

Optional text variables: `GRIDIRON_AI_PROVIDER` (`gemini` or `openai`), `GRIDIRON_GEMINI_MODEL`, `GRIDIRON_AI_MODEL`. The checked-in Cloudflare configuration selects `gemini-3.5-flash-lite`, which was verified on this deployment. The code fallback is `gemini-3.1-flash-lite`; OpenAI defaults to `gpt-4.1-mini`. Choose a model available to your account if a model is unavailable. Gemini wins when both keys exist unless overridden.

AI provider calls are capped globally at 12 per UTC minute and 200 per UTC day using a dedicated named Durable Object in the existing binding. The ten-minute public-stat cache avoids some repeated calls. Failed calls also consume a reservation. This public endpoint has no user login: someone can exhaust the shared allowance. Provider-side quotas and billing settings remain separate; keep them restricted. The cap covers calls made through this app, not direct use of a leaked key.

## Troubleshooting

- **Demo works, bridge unavailable:** deploy the complete project with Wrangler, not just `public/`. Check `/api/health` and the session binding/migration.
- **ESPN 401/403:** check league/season and fresh cookies from an authorized account. If local Python works but Cloudflare still fails with the same values, ESPN may be blocking Cloudflare requests; there is no setting that guarantees access.
- **Missing weeks:** import returns `unavailableWeeks`, preserving the original UI notice. Retry later.
- **Advanced stats unavailable:** nflverse may not have published the season, the release may be temporarily unavailable, or it may exceed the size/compute limit. Use the existing CSV import. Large season CSV parsing can exceed Cloudflare's free CPU allowance; inspect usage if this route repeatedly fails.
- **Unknown binding/migration:** retain the included config. If this existing Worker already has conflicting migration tags/classes, resolve with a new migration tag rather than deleting deployed migrations.
- **Wrong files/404:** repository root must contain `wrangler.jsonc`; assets must be `./public`; remove old deploy arguments and competing config files. Hard-refresh after deploying.
- **CORS:** keep frontend and API together on one hostname. Do not open HTML directly as a file.
- **Session disappears:** expiry, changing browsers/profiles, or changing hostnames requires reconnecting.
- **Free tier:** requests, CPU, Durable Object operations and storage have quotas. SQLite Durable Objects support the free plan; verify account allowances. Usage is not unlimited. AI provider charges are separate.

## Provenance and integration notes

Recovered October 21, 2026 from `Documents/Funz/Websites/Fantasy-Hub/GRIDIRON86-v9.6`, matching the latest accessible project conversation. The source folder was left untouched. `style.css` is unchanged. The original frontend scripts retain their logic with cloud connection-message edits. HTML wording is updated, and the owner's default league ID is removed.

`src/worker.js` replaces `server.py`. Python is unnecessary for this deployment and is not shipped as a public asset. League envelopes (`source`, `base`, `boxscores`, `unavailableWeeks`, `preferredTeamId`) and player/stat response fields match the existing frontend. The existing demo, Sleeper, JSON/CSV import, team views, player explorer and charts are retained.

Session storage changes from process RAM to one temporary Durable Object per browser, because Worker instances cannot reliably share process memory. Public in-memory caches contain no ESPN credentials or private league results.

Official references: [asset routing](https://developers.cloudflare.com/workers/static-assets/binding/), [Git-connected builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [workers.dev subdomains](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/), [custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), [Durable Object storage](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/), [OpenAI text generation](https://developers.openai.com/api/docs/guides/text), [Gemini generation](https://ai.google.dev/api/generate-content).

## Security review — October 21, 2026

The review tightened ESPN credential redirect handling, prevented a pending league request from restoring credentials after logout, preserved renewed sessions during stale expiry alarms, required JSON request content types, bounded local imports and protected player dictionaries from inherited property names. Browser headers restrict embedded objects, camera/microphone/location access, framing and referrers. A shared Durable Object caps AI provider requests at 12/minute and 200/UTC day, including failures. Automated regressions use fictional credentials. No real key belongs in this repository.

Rotate any API key shared in chat or another channel: create its replacement in Google AI Studio, update the existing Cloudflare `GEMINI_API_KEY` secret and deploy, confirm an overview works, then revoke the old key. Keep the replacement out of chat, source and screenshots. The public AI endpoint is not authenticated; another visitor can exhaust the shared allowance. Rate limits are not account authentication or a guarantee against service disruption. Review provider quotas/billing independently.

This was a bounded code, dependency, repository-history and deployment review, not a penetration test or an audit of account permissions, third-party systems, backup retention or all historical credential formats. ESPN, Google, Cloudflare, nflverse and Sleeper availability remains external.


## 9.7 / Original-theme strategy windows

The original GRIDIRON/86 Xerox-style theme is retained. Defensive Outlook, Touches & Share, and Trade Calculator sit together below Free Agent Wire / Variable Lab and above Personnel Register. The compact WINDOWED / TABBED switch in the menu bar stores the preferred layout locally. Tabbed mode reuses the existing expanded reports, supports arrow-key navigation, and hides the home tiles and individual dossiers.

Defensive Outlook shows a provider projection (or prior scoring mean), a scenario floor / ceiling, and the upcoming NFL opponent's team-level scoring rank. Ranges need four prior recorded weeks and use at most eight. They are not calibrated confidence intervals or position-adjusted defensive forecasts.

Touches & Share uses the compact public `public/data/usage-SEASON.json` dataset, generated daily by `.github/workflows/opportunity-data.yml` from NFLverse play-by-play. It includes carries, targets, receptions, team opportunity shares and inside-20 / inside-10 / inside-5 carries and targets. Shares cover the player's recorded weeks. Missing coverage stays blank. Refresh data in the report after the published dataset updates. Exhibition data is explicitly synthetic.

Trade Calculator compares modeled weekly scoring and both teams' optimized starting lineups. Starter format is user-selected. It does not submit trades or price keeper value. Both package selections persist while moving between views and reset when the active league/team changes.

Validation: `npm test` and `python3 -m unittest discover -s test -p 'test_usage.py'` from `fantasy-hub/`.

## v9.8 — full-width Star workspace

The desktop now uses the screen width. Player Outlook pairs an interactive red-to-green range with historical floor/projection/ceiling comparisons and an opponent report; the Player Terminal Scouting File opens that report. Historical ranges are reconstructed using only earlier observations. They are not archived forecasts, and missing provider projections remain blank.

The nightly NFLverse dataset now includes weekly offensive/defensive units. Matchup reports use only weeks preceding the selected week and show yards/play, net passing and rushing efficiency, sacks, turnovers, EPA, success rate and explosive rate. Explosives mean passing plays gaining at least 20 yards or rushing plays gaining at least 10. No-play penalties, kneels, spikes and two-point attempts are excluded. EPA is expected points added; success means positive EPA. These are observed team outcomes, not position-specific fantasy points allowed.

The optional AI matchup report requests 2–3 paragraphs. The Worker retrieves the opponent and team statistics itself; it does not accept caller-supplied opponent statistics. Existing server-side credentials, quotas and caching remain in effect. Exhibition data stays explicitly synthetic and does not trigger AI generation.

Outlook and opportunity reports have franchise/all-player selectors. Opportunity Leaders switches between the active franchise and all NFL players: click anywhere in a row to select, double-click for the Player Terminal; keyboard Enter selects and Enter again opens. Touches & Share includes four distinct share colors and compact workload context. The homepage trade builder supports player packages, partner changes, valuation modes and removal/clearing, sharing state with the full simulator.


## v9.9 — readable Star workspaces

- Larger data typography and controls throughout the original full-width desktop, with responsive clickable backdrop margins around reports.
- Chronological Player Outlook history, aligned range/evidence panels, tabular opponent stats and data-grounded AI interpretation using league comparisons and recent workload.
- Eight workload-share measures, weekly share charts with week-specific scoring drilldowns, and a labeled rushing/receiving TD probability scenario. TD estimates use recorded TDs with position shrinkage and recent workload, require four prior recorded weeks, and are not calibrated forecasts. Methodology remains available in the report.
- Stable roster-filter controls with indexed player matching and in-place result updates. Variable Lab uses a viewport-bounded canvas without the forced enrichment gap.
- Original scouting facts restored alongside a compact Outlook. Home Player Terminal gains a share chart.
- Trade scenarios now compare both optimized starting lineups, optional roster drops, projection/form/floor/ceiling valuations, package balance, and balancing counteroffers. No trade is submitted; dynasty/keeper/draft-pick and rest-of-season values are not supplied.


## v9.9.1 — interaction and analytics optimization

Trade counteroffers share player valuations and the two starting-lineup baselines within a synchronous comparison batch. The exact lineup solver avoids interchangeable-slot permutations and repeated lineup-array copies. New batches always use current projections, rosters, week and valuation settings.

Home trade edits update only the trade tile. Unchanged strategy markup retains its existing controls, focus and open explanations. Opportunity reports no longer calculate the leader table twice, and player matching reuses the dataset index.

The reproducible 19-counteroffer benchmark fell from 163.81ms to 91.87ms (44% lower median computation time on the same host). This measures analytics, not network or full-page load speed. See [optimization verification](docs/verification-9.9.1.md).


## v9.10 — clearer charts and the trade desk

- Variable Lab uses the available report viewport for the plot; data sources and exports move into a disclosure below it. Labels avoid collisions and appear immediately on dot hover or keyboard focus.
- Touches & Share supports individual weeks. Clicking a weekly share bar opens that player's selected-week workload report. Metric cards and share bars reveal definitions on demand.
- The home Position Allocation gains a period picker and larger bars; Matchup Center pairs a compact scoreboard with scrolling player lists.
- Trade Calculator centers package balance, exchanged-value shares and each team's percentage lineup change, with searchable roster pickers and expandable lineup details. Percentages describe modeled scoring, not acceptance probabilities.
- Chart backgrounds and labels no longer behave like oversized bar links. Navigation buttons keep square arrow controls and compact window ornaments.


## v9.11 — floating metric cards and automatic trade discovery

- Matched window ornaments, proportionate navigation controls, taller report windows, and the original Matchup Center score panel with its week selector in the title bar.
- Consistent player chart framing and W1/W2 labels. Share headings open season totals; individual bars open the selected player/week. Weekly Production measures its chart on first opening and viewport changes.
- Metric explanations float over their original tile (upward beneath Variable Lab), preserve chart/grid size, and dismiss with one click or Escape. All metric cards retain colored top borders.
- Either trade franchise can be selected. ESPN starting slots and player eligibility drive the optimizer; roster lists and comparison sections stay visible without nested scrolling or dropdown menus.
- Balancing pieces appear automatically. A background worker searches all one- and two-player packages for ordinary 17-player rosters (23,409 combinations), showing every modeled improvement for both teams in batches of 24. Required bench drops are included. Larger searches explicitly show their bounded scope.
- Replaced exponential lineup enumeration with an exact polynomial assignment solver, checked against exhaustive lineup and trade fixtures. No real trades or roster changes are submitted.

## v9.12 — homepage navigation and shared legibility

- Restore the original square title controls; anchor metric explanations to their side of the row, including wrapped layouts.
- Keep Variable Lab metric explanations on the homepage. Chart backgrounds open full player scoring/share reports; individual bars retain week-specific links.
- Show every matchup starter without a scroll box, with larger scores, a black title ribbon, and alternating paper rows. Move Position Allocation's period into its title ribbon.
- Give Points and Share matching plot geometry, expand Outlook's useful content, and show workload metrics only when applicable to the player.
- Combine trade package selectors and totals around a centered difference. Enlarge the matchup and starting-lineup tables and align the Club Overview's ledger with its stat grid.

## v9.13 — compact home reports and active-week analysis

- A shared Active Week selector synchronizes the homepage matchup and player forecasts. Historical weeks exclude later scoring and unscoped current projections.
- Outlook and Share follow Personnel Register selection, with no duplicate home selectors. Share shows three key metrics at home and eight in its full report.
- Home Outlook displays a compact analytical overview; generated reports now receive league-relative tier evidence and conclude with a provisional lineup role and decision tradeoffs.
- Matchup scores have a black ribbon with team names and records above the scores. Points chart surfaces open Position Allocation, while week bars still open starting-lineup reports.
- Player Terminal uses matching white metric tiles with colored strips in both views. The trade home tile uses larger totals, blue/red package favor and a central difference/balance readout.
