# 🎯 Dinger Tracker 2026 — Operations Guide

---

## Project Layout

```
/Users/joshbrodie/Desktop/claude_code/dingers/
├── config/draft.config.js     ← teams, draft order, season year
├── data/positions.csv         ← 827-player pool (from Baseball Reference)
├── ecosystem.config.js        ← PM2 process config
├── src/
│   ├── watcher/               ← live game poller
│   └── scripts/               ← all CLI tools
└── web/                       ← Next.js site (Vercel)
```

---

## 🗓️ Pre-Season Setup (do once, in order)

### 1. Configure teams & draft order
Edit `config/draft.config.js` — teams listed top-to-bottom = pick 1 through 10.

### 2. Run the Supabase migrations
In Supabase SQL editor, run these in order:
- `supabase/schema.sql` — base tables + views + RLS
- `supabase/migrations/002_add_drop_naming.sql` — add/drop support + season_config
- `supabase/migrations/003_draft_web.sql` — draft_position column + realtime

### 3. Load the player pool
```bash
npm run load-player-pool
```
Upserts all 10 teams (with draft positions) + inserts 827 players with `team_id = null`.

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
- Correct snake order (odd rounds left→right, even rounds right→left)
- A team can't draft a position they already own
- Can't draft an already-drafted player

**After the real draft** — run this to link MLB player IDs for accurate name matching during the season:
```bash
npm run fetch-mlb-ids:save
```

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
| `dinger-watcher` | Polls MLB API every 60s for live HRs | Restarts at **noon ET** every day |
| `dinger-summary` | Sends morning iMessage recap | Fires at **8am** every day |

### How the watcher works
- Polls all live MLB games every 60 seconds
- When a tracked player hits a HR: saves it to Supabase, fires an iMessage to the group chat
- Alert includes: player name, team, HR count, distance, standings update
- Auto-shuts down after ~2 hours of no active games; PM2 revives it at noon next day

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
| `reset-draft` | **Wipe all draft picks + unassign all players** (testing / redo) |

---

## 🧪 Testing / Seed Data

### Seed fake data (for testing the web UI)
```bash
npm run seed
```
Creates 10 teams, 90 players (one per position per team), and ~200 fake HRs across July 15–Sept 15 2026.

### Wipe all seed data
```bash
npm run seed:wipe
```
Clears all tables: `home_runs`, `draft_picks`, `players`, `teams`.

### Full reset to test the draft
```bash
npm run seed:wipe        # clear everything
npm run load-player-pool # reload real 827-player pool + teams
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

# After draft
npm run fetch-mlb-ids:save   # link MLB IDs for name matching

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
