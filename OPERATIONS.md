# 🎯 Dinger Tracker 2026 — Operations Guide

---

## Project Layout

```
/Users/joshbrodie/Desktop/claude_code/dingers/
├── config/draft.config.js     ← teams, draft order, season year
├── data/dingers_player_data.xlsx ← player pool (MAIN tab: MLB IDs, Statcast names, HRs, team, position)
├── ecosystem.config.js        ← PM2 process config
├── src/
│   ├── watcher/               ← live game poller
│   └── scripts/               ← all CLI tools
└── web/                       ← Next.js site (Vercel)
```

---

## 🗓️ Pre-Season Setup (do once, in order)

### 1. Configure teams & draft order
Edit `config/draft.config.js` — teams listed top-to-bottom = pick 1 through N (currently 11 teams). The draft order, snake logic, and team count everywhere else (web app, admin CLI) are all derived dynamically from this list and from the `teams` table — you can add or remove teams here without touching any other code.

### 2. Run the Supabase migrations
In Supabase SQL editor, run these in order:
- `supabase/schema.sql` — base tables + views + RLS
- `supabase/migrations/002_add_drop_naming.sql` — add/drop support + season_config
- `supabase/migrations/003_draft_web.sql` — draft_position column + realtime
- `supabase/migrations/004_mlb_team.sql` — mlb_team column
- `supabase/migrations/005_preseason_hrs.sql` — preseason_hrs column (pre-draft season HR reference stat)
- `supabase/migrations/006_team_colors.sql` — adds draft_position to team_standings/daily_team_hrs (stable per-team color assignment)

### 3. Load the player pool
Make sure `data/dingers_player_data.xlsx` is present (MAIN tab is the source of truth — mlb_player_ID, mlb_statcast_name, DraftBuddy Name, Team, HR, Pos). This replaces the old `fetch-positions.js` → `positions.csv` scrape flow; that script is still in the repo but no longer part of the normal setup path.

```bash
npm run load-player-pool
```
Upserts all teams from `config/draft.config.js` (with draft positions) + inserts players with `team_id = null`, including their MLB Statcast player ID, Statcast naming convention (both used for reliable live-game name matching — no need to run `fetch-mlb-ids` before the draft anymore, since IDs are already in the workbook), team abbreviation, position, and pre-draft season HR total.

### 4. Set web env vars
Copy `web/.env.local.example` → `web/.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from Supabase dashboard)
- `SUPABASE_SERVICE_KEY` (service role key — keeps server-side only)
- `ADMIN_PIN` (your secret PIN for making draft picks on the site)

---

## 🎯 Draft Day

The draft lives at **`/draft`** on the web app. Everyone can view it live; only you can make picks.

**Flow:**
1. Open `/draft` — shows the full board + current pick
2. Click **Unlock**, enter your admin PIN
3. Filter by position if desired, search for a player, click their name
4. Click the yellow **Draft** button — pick is committed instantly
5. Board updates in real time for all viewers (Supabase Realtime)

**Rules enforced server-side:**
- Correct snake order (odd rounds left→right, even rounds right→left), derived from however many teams are in `config/draft.config.js` / the `teams` table — never hardcoded
- A team can't draft a position they already own
- Can't draft an already-drafted player

**Made a mistake mid-draft?** Open the admin panel's **Draft** tab (web) or run `npm run admin` → `undo-last-pick` / `override-pick` (CLI) — see [Fixing a Draft Pick](#-fixing-a-draft-pick) below.

**After the real draft** — MLB player IDs are now pre-loaded from `dingers_player_data.xlsx`, so this step is usually unnecessary. Only run it if a drafted player is missing an ID (e.g. a late add not in the original workbook):
```bash
npm run fetch-mlb-ids:save
```

---

## ↩️ Fixing a Draft Pick

Two ways to correct a mistake mid-draft, without wiping the whole thing:

**Undo last pick** — un-drafts whoever was picked most recently and deletes that pick record, so the player is available again and it becomes the current pick again. Click it repeatedly to rewind further back one pick at a time.
- Web: Admin panel → **Draft** tab → **Undo last pick**
- CLI: `npm run admin` → `undo-last-pick`

**Override a pick** — swap the player on any past pick (not just the most recent one) for a different currently-available player at the *same position*, without touching round/pick numbering or any other pick. Use this to fix "we drafted the wrong guy" three picks ago without rewinding everyone after it.
- Web: Admin panel → **Draft** tab → pick the row → choose a replacement
- CLI: `npm run admin` → `override-pick` → pick from the list → choose a replacement

**Reset draft** — nuclear option: wipes every pick and unassigns every player. Use for a full redo (e.g. a test/fake draft).
- Web: Admin panel → **Danger Zone**
- CLI: `npm run admin` → `reset-draft`

---

## 🔄 Daily Watcher (Season-Long, Automated)

The watcher must run on a **Mac** (iMessage dependency). Uses PM2 for process management.

### Start everything
```bash
npm run pm2:start
```
Starts two processes:

| Process | What it does | Schedule |
|---|---|---|
| `dinger-watcher` | Polls MLB API every 60s for live HRs | Restarts at **11am ET** every day |
| `dinger-summary` | Sends morning iMessage recap | Fires at **8am** every day |

### How the watcher works
- Polls all live MLB games every 60 seconds, matching batters against the rostered-player cache (by MLB player ID first, name as a fallback) — only currently-drafted, not-dropped players are tracked
- Dedupes by `gamePk:atBatIndex`, both in-memory and against HRs already in the DB, so a restart mid-game won't double-alert
- When a tracked player hits a HR: saves a `home_runs` row (distance, launch angle, exit velocity, spray x/y coordinates, game/at-bat identifiers, Mickey Meter result) to Supabase, then fires an iMessage to the group chat
- Alert includes: player name + season HR total, distance, fantasy team, team HR total, current standings rank, and the Mickey Meter result ("would it dong" in X/30 parks)
- Player and team HR totals aren't stored as separate incrementing counters — they're computed live via SQL views (`player_standings` / `team_standings`) over the `home_runs` table, so there's no drift risk between the watcher, the web app, and add/drop transactions
- Auto-shuts down after ~2 hours of no active games; PM2 revives it at 11am ET next day. Note: if a day ever has a game scheduled to start before 11am ET (early getaway-day game, doubleheader, etc.), the watcher won't be running yet to catch it — adjust `cron_restart` in `ecosystem.config.js` if that becomes a real concern

### The Mickey Meter ("Would It Dong?")
For every logged HR, the watcher checks the ball's distance/angle/launch data against traced fence outlines for all 30 parks (`data/mlb_stadia_paths.csv`) and reports how many of them it would have cleared (X/30), with a joke label (`getDongLabel` in `src/watcher/alerts.js`) ranging from "100% Mickey Mouse Bullshit" to "okay kinda legit." Fence height data isn't available per park, so a uniform 8 ft is assumed for all 30 — real fences vary a lot (Fenway's Green Monster is 37 ft), so treat this as a fun approximation, not a precise model.

### PM2 commands
```bash
npm run pm2:status    # see if processes are running
npm run pm2:logs      # tail live watcher logs
npm run pm2:stop      # stop everything (off-season, travel, etc.)
npm run pm2:start     # start everything back up
```

### Manual one-offs
```bash
node src/watcher/index.js        # run watcher manually (Ctrl+C to stop)
node src/scripts/send-summary.js # fire the morning summary right now
```

### Running unattended (no manual `npm run pm2:start` every day)

Because alerts go out over iMessage, this has to run on your actual Mac — there's no cloud-hosted equivalent for AppleScript/Messages.app. But you can get most of the way to "set it and forget it" with these one-time setup steps:

**0. Disable system sleep entirely (do this first — it's the actual fix, not just a workaround).** A locked screen is completely fine — background processes (including PM2/Node) keep running normally while locked. But real *system sleep* suspends the whole process, including the watcher's 60s poll timer and any in-flight network request. Since this runs on an iMac that's always on wall power (not battery), there's no downside to just turning sleep off entirely:
```bash
sudo pmset -c sleep 0       # never sleep on AC power
sudo pmset -c disksleep 0   # don't spin down the disk either
```
The display can still turn off on its own schedule (`pmset -c displaysleep <minutes>`) — that doesn't affect background processes at all, only actual system sleep does. Confirm with `pmset -g`.

**1. Auto-relaunch PM2 on login/reboot**, so if the Mac restarts (macOS update, crash, power blip) it comes back on its own:
```bash
pm2 startup
```
This prints a `sudo ...` command — copy and run exactly that line once. Then save the current process list so it knows what to bring back:
```bash
pm2 save
```
Re-run `pm2 save` any time you add/remove a PM2 process.

**2. Schedule the Mac to wake up before the 11am ET restart**, as a redundant safety net in case sleep ever gets re-enabled (by a macOS update, etc.) despite step 0 — PM2's cron can't fire while the machine is asleep:
```bash
sudo pmset repeat wakeorpoweron MTWRFSA 10:55:00
```
Check it's set with `pmset -g sched`.

**Limits of this setup (why it's "hardened," not bulletproof):**
- Step 0 only controls *this* Mac's own sleep behavior — if it loses power entirely (outage, dead battery, unplugged, physically off for repair) nothing will bring it back until you power it on and log in yourself — at which point `pm2 resurrect` kicks in automatically from step 1.
- Don't fully log out — a locked screen is fine, but a logged-out session won't run the LaunchAgent PM2 registered.
- **Even if the Mac does sleep** (missed step 0, or a game runs during a brief unavoidable nap), the watcher (`src/watcher/index.js`) gives every game one grace "catch-up" poll right after it drops off the active-games list — this specifically covers a game finishing *while the process was suspended*, which otherwise would've been silently skipped forever (the main loop only ever looks at currently-active games, so a game that flips Live→Final during downtime would never be revisited without this). It re-fetches that game's full play-by-play (not incremental) one last time, so anything from the tail end of the game still gets caught, just later than normal. This isn't a substitute for step 0 — it only recovers missed *home runs*, not the real-time promptness of the alert — but it means a sleep gap can no longer cause silent, permanent data loss.

If you want true zero-Mac-dependency reliability (survives your Mac being off, dead, or at the shop), the real fix is moving off iMessage to a cloud-native alert channel (Twilio SMS, Slack/Discord webhook, email) so the whole watcher can run on a $0–5/mo cloud box instead of your Mac — a bigger change, but worth it if these Mac-dependency edge cases start actually biting you.

---

## ➕➖ Add/Drop a Player

```bash
npm run add-drop
```

Interactive CLI — walks you through:
1. Pick a team (shows their add/drop budget used/remaining)
2. Pick which player to drop
3. Type the name of the player to add
4. Confirms and commits

**What happens under the hood:**
- Dropped player gets a `dropped_at` timestamp — their HRs before that date still count
- New player is inserted with `added_at` — only their HRs from that date forward count
- Transaction is logged in the `transactions` table
- Default budget: **2 adds per team** per season (configurable via admin)

---

## 🔧 Admin Tools

```bash
npm run admin
# or with a specific command:
node src/scripts/admin.js <command>
```

| Command | What it does |
|---|---|
| `fix-player-name` | Correct display name or set MLB API name override |
| `fix-hr-distance` | Manually set a HR's distance |
| `set-add-drop-limit` | Change the season-wide add/drop budget (default: 2) |
| `show-roster` | Dump all rosters with HR counts |
| `show-transactions` | List all add/drop history |
| `undo-last-pick` | Undo the most recent draft pick — repeatable to rewind further back |
| `override-pick` | Swap the player on any past pick for a different available same-position player |
| `reset-draft` | **Wipe all draft picks + unassign all players** (testing / redo) |

The same tools are also available in the web app's admin panel (**Draft** tab), which mirrors the CLI 1:1 and is usually the faster option during a live draft.

---

## 🧪 Testing / Seed Data

### Seed fake data (for testing the web UI)
```bash
npm run seed
```
Creates one team per entry in `config/draft.config.js` (currently 11), one player per position per team, and ~200 fake HRs across July 15–Sept 15 2026.

### Wipe all seed data
```bash
npm run seed:wipe
```
Clears all tables: `home_runs`, `draft_picks`, `players`, `teams`.

### Full reset to test the draft
```bash
npm run seed:wipe        # clear everything
npm run load-player-pool # reload real player pool (from dingers_player_data.xlsx) + teams
```

---

## 🌐 Web App Pages

| URL | What's there |
|---|---|
| `/` | Standings — live bar chart + table, updates on every HR |
| `/timeline` | The Race — cumulative HR chart over the season |
| `/spray` | Spray chart — scatter plot of all HRs by team |
| `/roster` | Rosters — all teams' drafted players |
| `/h2h` | Head-to-head matchups |
| `/draft` | Draft board — live grid, admin pick panel |

**Deploy:** push to GitHub, Vercel auto-deploys on push. Set the same env vars from `web/.env.local` in the Vercel dashboard under project settings.

---

## 📂 Key Config Files

| File | Edit when... |
|---|---|
| `config/draft.config.js` | Changing teams or draft order pre-season |
| `.env` | Supabase keys, iMessage chat name, poll interval |
| `web/.env.local` | Supabase keys + admin PIN for the web app |
| `ecosystem.config.js` | Changing watcher/summary schedule (cron syntax) |

---

## ⚡ Quick Reference Cheat Sheet

```bash
# Season start
npm run load-player-pool     # load player pool
npm run pm2:start            # start watcher + summary

# During draft
# → use the /draft page on the web app
# → mistake? undo-last-pick or override-pick (admin panel Draft tab, or `npm run admin`)

# After draft — only if a drafted player is missing an MLB ID
# (xlsx already has IDs for the original pool; this is for late adds only)
npm run fetch-mlb-ids:save

# Add/drop
npm run add-drop

# Admin fixes
npm run admin

# Monitor
npm run pm2:status
npm run pm2:logs

# Testing
npm run seed                 # fake data
npm run seed:wipe            # clear all
npm run load-player-pool     # restore real pool

# Off-season
npm run pm2:stop
```
