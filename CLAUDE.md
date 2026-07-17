# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A private fantasy-baseball-style pool for a friend group ("Dinger Tracker"). After the MLB All-Star break, friends snake-draft real MLB hitters; whoever's roster hits the most home runs the rest of the season wins. There's a public-facing web dashboard, a Supabase backend, and a Mac-resident live game watcher that texts the group chat via iMessage whenever a rostered player homers.

## Repo layout — two independent deployables

This is **not** a single app. It's two separately-run things sharing one Supabase database:

1. **`web/`** — Next.js 14 (App Router) + TypeScript site, deployed on Vercel, auto-deploys on `git push origin main`. Public dashboard + admin panel. Talks to Supabase directly from both server routes (service role key) and the browser (anon key).
2. **Root-level `src/`** — plain Node/CommonJS CLI scripts + the live watcher, run from a terminal on whichever Mac is designated to run it (currently Josh's iMac, chosen specifically because iMessage requires real macOS — this can't be hosted in the cloud as-is). Managed via PM2 (`ecosystem.config.js`).

Both halves read/write the same Supabase Postgres database (see `supabase/schema.sql` + `supabase/migrations/*.sql`), and there's no other integration point between them — no shared runtime, no RPC between web and watcher.

## Commands

### Root (watcher + CLI scripts, run from repo root)
```bash
npm install                      # install root deps

# Pre-season
npm run load-player-pool         # load data/dingers_player_data.xlsx → Supabase (teams + players)
npm run fetch-mlb-ids:save       # only needed for a late add not already in the xlsx

# Live watcher (must run on a Mac signed into the target iMessage account)
npm run pm2:start                # start dinger-watcher + dinger-summary under PM2
npm run pm2:stop
npm run pm2:status
npm run pm2:logs                 # tails dinger-watcher logs specifically
node src/watcher/index.js        # run the watcher directly, foreground (Ctrl+C to stop)
node src/scripts/send-summary.js # fire the daily recap once, manually

# Draft / admin / add-drop CLIs (interactive, inquirer-based)
npm run admin                    # fix-player-name, fix-hr-distance, undo-last-pick, override-pick, reset-draft, etc.
npm run add-drop

# Test data
npm run seed                     # seed fake teams/players/HRs for UI testing
npm run seed:wipe                # wipe seeded data
```

### `web/` (Next.js site, run from `web/`)
```bash
cd web
npm install
npm run dev      # local dev server
npm run build    # production build
npm run lint     # next lint
```

### Verifying changes (no test suite exists in this repo)
There is no Jest/Vitest/etc. anywhere in this project — don't go looking for one or assume you should add one unless asked. The verification patterns actually used here:
- Root CommonJS scripts: `node --check path/to/file.js` (syntax only) plus targeted `node -e "..."` sandbox snippets that `require()` the module and exercise it directly against real local data (e.g. the xlsx or a CSV) when you need to verify actual behavior, not just that it parses.
- `web/`: `npx tsc --noEmit -p tsconfig.json` from inside `web/` is the fast correctness check before pushing.

## Architecture

### Data model (Supabase Postgres, see `supabase/schema.sql` + migrations in order 002→006)
- `teams` — one row per fantasy team. `draft_position` (added in 003) drives snake draft order and is also the stable key the web app's `getTeamColor()` uses to give every team a fixed, non-colliding color across all pages (006 exposes it on `team_standings`/`daily_team_hrs` for this).
- `players` — the pool. `team_id` null = undrafted. `position` is a hard CHECK constraint (`C,1B,2B,3B,SS,LF,CF,RF,DH`) — one player per position per team, enforced at the API layer, not the DB. `mlb_player_id`/`mlb_api_name` (002) are the live-matching keys against the MLB Stats API; `mlb_team` (004) and `preseason_hrs` (005) are informational display fields for the Player Pool page, unrelated to in-pool scoring. `added_at`/`dropped_at` (002) window a player's HRs for add/drop accounting — see below.
- `home_runs` — one row per home run ever detected by the watcher, `UNIQUE(game_pk, at_bat_index)`. Stores full Statcast detail: distance, launch_angle, launch_speed, spray_x/spray_y coordinates, plus `mickey_meter_count`/`mickey_meter_label` (the "would it dong" park-clearance joke stat, see below).
- `draft_picks` — one row per pick, `UNIQUE(season, overall_pick)`.
- `transactions` / `season_config` (002) — add/drop history and the season-wide add/drop budget (default 2 per team).
- **Standings are views, not stored counters**: `team_standings`, `player_standings`, `daily_team_hrs` compute HR totals live via `COUNT()` over `home_runs`, correctly windowed by each player's `added_at`/`dropped_at` (a dropped player's pre-drop HRs still count for their old team; a newly-added player's HRs only count from their `added_at` forward). There is deliberately no incrementing counter column anywhere — don't add one; it would just introduce drift risk the views already avoid.
- RLS: all tables are public-read (web dashboard uses the anon key); all writes go through the Supabase **service role key**, used server-side only (web API routes, root CLI scripts, the watcher) — never exposed to the browser.

### Draft logic — team count must always be dynamic
`config/draft.config.js` is the single source of truth for teams/order/rounds/positions (currently 11 teams, 9 rounds, one pick per position). The snake order (odd rounds left→right, even right→left) is computed from `teams.length` wherever it's needed — `web/src/app/api/draft/pick/route.ts`, `web/src/components/DraftBoard.tsx`, and `src/scripts/draft.js` all derive it from the live team count. **Never hardcode a team count constant anywhere** — this exact mistake (a stray `const TEAM_COUNT = 10`) broke the snake order in production once already when the league went from 10 to 11 teams.

Draft corrections exist in two parallel surfaces that must stay in sync: the web admin panel (`AdminPanel.tsx` → `web/src/app/api/admin/route.ts`) and the CLI (`src/scripts/admin.js`), both operating on the same tables. `undo-last-pick` un-drafts whichever pick has the highest `overall_pick` (repeatable to rewind further); `override-pick` swaps the player on any specific past pick for a different available same-position player without touching pick numbering.

### The live watcher (`src/watcher/index.js`)
Polls `statsapi.mlb.com` every 60s (`POLL_INTERVAL_MS`) for all live games, matches batters against an in-memory cache of currently-rostered (drafted, not dropped) players — by MLB numeric ID first, name as fallback — and on a new home run: computes the Mickey Meter result, inserts a `home_runs` row, then fires an iMessage alert. Dedup is by `` `${game_pk}:${at_bat_index}` `` checked against both an in-memory `seen` Set (hydrated from the DB on startup, so a restart mid-game is safe) and the DB's own unique constraint. Each poll also gives any game that just dropped off the active-games list one grace "catch-up" pass (`recentlyActiveGamePks` diffing in `pollGames()`) — this specifically covers the host Mac going to system sleep mid-game and the game finishing before it wakes, since otherwise a game that flips Live→Final during that gap would never be revisited (the main loop only ever processes currently-active games). Auto-exits after ~2 hours of no active games; PM2's `cron_restart` in `ecosystem.config.js` revives it daily (currently 11am ET, pinned via `time_zone: 'America/New_York'` so it doesn't depend on the host machine's local clock). See OPERATIONS.md's "Running unattended" section for the `pmset` config that should prevent the Mac from sleeping in the first place — the catch-up sweep is a safety net for it, not a replacement.

`src/watcher/mlbApi.js`'s `getHitData()` specifically prefers the playEvent where `details.isInPlay === true` over just the first event with a `hitData` block — a foul ball earlier in the same at-bat can also carry hitData, and picking the wrong one would record the foul's exit velo/distance instead of the actual home run's.

### The Mickey Meter ("would it dong?") — `src/watcher/mickeyMouse.js`
For every HR, checks the ball's distance/launch data against traced outfield-fence points for all 30 parks (`data/mlb_stadia_paths.csv`, columns are `team,x,y,segment` — only the `outfield_outer` segment is the real fence) and reports how many parks it would have cleared (X/30). Coordinates use the Gameday hit-coordinate convention (home plate ≈ `(125.42, 198.27)`, ~2.495 ft/unit) — the same convention as `hitData.coordinates` from the MLB Stats API. There's no per-park fence-height data available, so a uniform 8 ft is assumed for all parks; treat this as a fun approximation, not a precise physical model.

### iMessage delivery (`src/watcher/alerts.js` + `applescripts/*.applescript`)
Every alert spawns a fresh `osascript` process against the relevant `.applescript` file — so editing the AppleScript files takes effect immediately on the next alert, no restart needed. `IMESSAGE_GROUP_CHAT` (from `.env`) is read once via `dotenv` at process startup and cached in memory, so **changing `.env` requires restarting the watcher** (`pm2 restart ecosystem.config.js`) to take effect. The two AppleScript files intentionally take their arguments in different orders (`sendMessage.applescript` expects `(message, chatTarget)`; `sendMessage_summary.applescript` expects `(chatTarget, message)`) — this isn't a bug, don't "fix" it into consistency without checking both scripts. The chat lookup matches by `chat whose name contains chatTarget` in Messages.app on whichever Mac is running the watcher — the group chat must appear under that exact name in that Mac's own Messages.app (i.e., that Mac's iMessage account must already be a participant), or it falls back to treating the target as an individual buddy handle/phone number.

### Player pool data source (`src/lib/playerData.js`)
`data/dingers_player_data.xlsx`'s `MAIN` tab is the pre-season source of truth (replaced the older `fetch-positions.js` → `data/positions.csv` scrape flow, which is still in the repo but no longer part of the normal setup path). It already includes MLB Statcast player IDs and naming, so `fetch-mlb-ids:save` is normally unnecessary — only needed for a late add/drop replacement not in the original workbook. The loader de-dupes by `mlb_player_id`, keeping whichever duplicate row has the higher `preseason_hrs`.

### Web app structure (`web/src/`)
App Router pages under `app/`: `/` (standings), `/timeline`, `/spray`, `/roster`, `/h2h`, `/draft`, `/pool` (player pool), `/admin`. Server-side admin actions all funnel through `web/src/app/api/admin/route.ts` and `web/src/app/api/draft/pick/route.ts`, both gated by `ADMIN_PIN` compared against `process.env.ADMIN_PIN` — there's no real auth system, just a shared PIN. `web/src/lib/supabase.ts` and `types.ts` hold the client setup and shared TS types. Realtime subscriptions (`players`, `draft_picks`, `home_runs` — enabled via `ALTER PUBLICATION supabase_realtime ADD TABLE ...` in the migrations) drive live updates on the draft board and standings without polling.

## Operational runbook

Day-to-day setup, deploy, and troubleshooting steps live in `OPERATIONS.md`, not here — that file is the up-to-date source for "how do I load the player pool," "how do I fix a bad draft pick," "how do I get the watcher running unattended," etc. Read it before re-deriving any of that from scratch.
