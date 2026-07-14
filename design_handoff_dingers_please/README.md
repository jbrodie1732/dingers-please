# Handoff: Dingers, Please — 2026 Post-ASB Home Run Derby League

> **For the developer:** The files in `design_files/` are **design references** — an interactive HTML prototype showing the intended look, feel, and behavior of the app. They are **not** production code to ship as-is. Your job is to **recreate these designs in the existing `dingers-please` codebase** (Next.js + Supabase), wiring them to the **real database schema, real API routes, real auth, and real Twilio SMS hooks** that already exist. Where the prototype uses mock data or local state, replace it with calls into the existing data layer. **The single most important rule of this handoff is: do not rebuild functionality that already works in the codebase. Wire to it.**

---

## 1. Overview

**Dingers, Please** is an existing Next.js + Supabase fantasy home-run-derby app for a friends-and-family league that runs from the All-Star Break through the World Series. The backend, schema, draft logic, scoring, and Twilio SMS pipeline are already implemented and working. This design pass is a **comprehensive UI/UX redesign** that:

1. Replaces the existing front-end with a broadcast-scoreboard aesthetic ("Bleachers" theme) inspired by classic baseball card design, stadium signage, and ESPN ticker chrome.
2. Adds new visualizations: **The Race** (cumulative HR line chart over time), **Head-to-Head** (any-two-teams comparison with lead tracker), **Spray chart + Mickey Meter** (player big-board with elite-HR gauge), **Player Pool** (filterable available-player grid).
3. Introduces a **commissioner admin panel** with PIN-gated access for in-season add/drops, manual HR logging, season config, transaction history, and danger-zone reset actions.
4. Adds a **Real-Time mode** to The Race and H2H — a scrubbable timeline showing how standings evolved hour-by-hour across the 45-day season.

### Fidelity

**High-fidelity.** The mockups have final colors, typography, spacing, copy tone, hover states, and animation timings. Recreate them pixel-perfectly using the project's existing component patterns. Where Tailwind / shadcn / CSS Modules conventions exist in the codebase, **use them** — do not paste the prototype's `styles.css` wholesale.

---

## 2. About the Design Files

| File | What it represents | What to extract |
|---|---|---|
| `Dingers Please.html` | Entry point — loads React + Babel + all JSX modules + styles | Page structure, head/meta, font loading strategy |
| `shell.jsx` | App layout — top bar, nav routing, HR celebration toast, tweaks state, mock HR simulator | Layout shell, top-bar markup, lock-icon admin trigger, route map |
| `standings.jsx` | Standings home page — hero last-HR moment + standings table + activity feed | Hero card layout, standings row design, "live" pulsing indicators |
| `draft.jsx` | Draft room — snake board + on-the-clock + position grid + search | Snake-board grid, on-the-clock card, available-player filtering, pick animations |
| `other-screens.jsx` | Spray, Rosters, Pool screens (note: also exports `BigField`, `MickeyDetail`, `TierDots`) | Spray field SVG, Mickey Meter gauge, roster card layout, pool filters |
| `timeline-screens.jsx` | **NEW** — The Race + H2H with Static/Real-Time toggle, playback bar, lead tracker | Timeline scrubber UX, hourly event interpolation, live leaderboard movement arrows, H2H lead-tracker SVG |
| `admin.jsx` | **NEW** — PIN gate + tabbed commissioner panel (Add/Drop, Manual HR, Season, History, Danger) | Tab navigation, 3-step add/drop flow, manual HR form, PIN re-prompt for destructive actions |
| `data.jsx` | Mock data — teams, players, HR feed, draft picks, hourly events | Data **shapes** only — every field maps to a real Supabase column (see §6) |
| `styles.css` | Full CSS system | Design tokens (§7), animation timings, layout conventions |
| `tweaks-panel.jsx` | Designer-only tweaks panel — **not for production** | Skip entirely |

---

## 3. Critical Wiring Directive — Read This First

The existing `dingers-please` codebase **already has**:

- ✅ Supabase Postgres schema for teams, players, draft picks, home runs, transactions, seasons
- ✅ Draft engine (snake order, pick clock, position eligibility)
- ✅ Live HR ingestion (likely from MLB stats API → Supabase)
- ✅ Twilio SMS sender wired to HR events
- ✅ Auth (probably Supabase Auth with email magic links or league-passcode gate)
- ✅ Cron / scheduled functions for end-of-day standings snapshots

**You must NOT:**
- ❌ Re-implement the draft engine in the front end
- ❌ Re-implement HR scoring logic
- ❌ Re-implement the SMS sender
- ❌ Invent new tables; use what's there
- ❌ Re-create auth — gate the new admin panel using the **existing** commissioner role (likely a `is_commissioner` flag on the `users` table or a `role` enum)

**You MUST:**
- ✅ Read `src/lib/db/schema.ts` (or `db/schema.prisma`, `supabase/migrations/`, whatever the project uses) **first** before writing a single line of UI code
- ✅ Map every prototype data field to its real column — see the mapping table in §6
- ✅ Replace prototype mock state (`useState`, in-memory arrays in `data.jsx`) with the existing data-fetching hooks/queries (likely `useSWR`, server components, or Supabase realtime subscriptions)
- ✅ Use the existing Twilio integration for the "Manual HR → Log + Send SMS" button — do not write a new SMS sender
- ✅ Use the existing `transactions` (or equivalent) table for add/drop history — do not invent a new one
- ✅ Preserve all server-side validation (drop limits, position eligibility, draft order) — the front end only renders state and submits intents

If a feature in the prototype has **no backend equivalent**, raise it explicitly before adding tables. Most likely candidates: hourly HR-event aggregation for The Race timeline (§8), and the season-config "max add/drops per team" setting if it doesn't already exist.

---

## 4. Screens / Views

### 4.1 Top Bar (global)

- **Location:** Sticky top of every screen.
- **Layout:** Three-column grid (`auto 1fr auto`), max-width 1480px, 12px × 24px padding, blurred dark background `rgba(10,14,12,0.85)` with `backdrop-filter: blur(12px)`, 1px bottom border `--c-border`.
- **Left:** Brand mark (32×32 SVG of stitched baseball, bone color on green) + brand stack with "DINGERS, PLEASE" (Bricolage Grotesque 800, 18px, `--c-bone`) and "EST. 2026 · POST-ASB" (DM Mono, 9px, `--c-textMuted`).
- **Center:** Nav buttons (one per route): glyph (3-letter mono code) above label. Active state: yellow `--c-accent` underline + bone text. Routes: `STD Standings`, `RAC The Race`, `H2H Head to Head`, `SPR Spray Charts`, `ROS Rosters`, `DRA Draft Room`, `POL Player Pool`.
- **Right:** Live pill (pulsing green dot + "LIVE" + count of HRs today) + lock button (32×32 rounded square, padlock icon, opens admin overlay).

**Wiring:** The live count comes from `select count(*) from home_runs where hit_at::date = current_date`. The lock button only shows for users with `is_commissioner = true`; for non-commissioners, hide it entirely (do not render disabled).

### 4.2 Standings (route: `standings`)

- **Hero "Last HR" card** — full-bleed dark surface, shows the most recent HR with team color accent stripe, player photo placeholder, exit velocity / distance / launch angle stats in DM Mono. Pulses subtly when a new HR lands (CSS `@keyframes hr-pulse`).
- **Standings table** — rank, team name (clickable → roster), HR count (large Bricolage), trend sparkline (last 7 days), GB (games-back, in mono).
- **Activity feed** (right rail) — chronological mini-tickers of recent HRs and add/drops.

**Wiring:** Use existing standings query. The hero card subscribes to Supabase realtime channel on `home_runs` table; on insert, fire the in-app celebration toast (already coded in `shell.jsx` as `simulateHR` — replace with the real channel payload).

### 4.3 The Race (route: `race`)

- **Static mode (default):** Cumulative HR-count line per team over the season-to-date, x-axis = date, y-axis = HRs. SVG paths with team-color strokes. End-of-line team labels.
- **Real-Time mode (toggle):** Adds a **playback bar** below the chart — play/pause, time slider (0–100% of season elapsed), 1×/2×/4×/8× speed buttons, hourly timestamp readout. As the playhead moves, the chart redraws to that moment in time, and a **live leaderboard panel** below shows current standings with movement arrows (▲ green when a team passes another, ▼ orange when passed) since the previous frame.

**Wiring:**
- Static mode: aggregate `home_runs` by `team_id` and `date_trunc('day', hit_at)`, emit one path per team.
- Real-Time mode: the prototype uses synthetic hourly events. **Question for you to resolve before implementing:** does the schema already store `home_runs.hit_at` as a precise timestamp? If yes, aggregate by hour on the fly (it's only ~1080 hours over 45 days — small). If only date-precision is stored, talk to the user before adding a hit-time column.

### 4.4 Head to Head (route: `h2h`)

- **Two team selectors** at top — clicking either opens a dropdown of league teams.
- **Comparison line chart** — two paths only, with shaded area between them showing the lead margin.
- **Static / Real-Time toggle** — same UX as The Race.
- **Lead tracker bar (Real-Time only):** A horizontal bar below the chart, segmented hour-by-hour, each segment colored by whichever team is leading at that moment. Tied moments are dim. White vertical playhead marker tracks the current scrubber position.

**Wiring:** Same data source as The Race, filtered to two team IDs.

### 4.5 Spray Charts (route: `spray`)

- **Big field SVG** — top-down view of an MLB park outline. HR landing-spot dots scaled by exit velocity, colored by team or by "Mickey-tier" (legendary HRs).
- **Mickey Meter** — circular gauge (right side) showing the "elite HR" score (HRs > 440 ft, EV > 110 mph, etc.). Animated needle.
- **Tier dots legend** (bottom).

**Wiring:** Each HR row needs `landing_x`, `landing_y` (or `spray_angle` + `distance`), `exit_velocity`, `launch_angle`, `is_mickey` (computed from thresholds — likely already a column or a view).

### 4.6 Rosters (route: `rosters`)

- **Team cards grid** — one card per league team, showing roster slots (C, 1B, 2B, 3B, SS, LF, CF, RF, DH, BENCH×3) with player names + season HR counts.
- **Click team → expanded view** with full stat lines.

**Wiring:** Standard `select * from rosters where team_id = $1`. Position eligibility comes from `players.eligible_positions[]`.

### 4.7 Draft Room (route: `draft`)

- **Snake board** — 12-team × 25-round grid. Each cell shows pick number, player name, team color stripe. Empty cells show round/pick number ghost text.
- **On-the-clock card** (top) — current team avatar, countdown timer (mm:ss), "DRAFTING NOW" pulsing badge, big team name.
- **Available player rail** (right) — search input, position-filter chips (ALL / C / 1B / ... / OF / DH), sortable by ADP / projected HRs / last season HRs.
- **Pick animation:** When a pick is made, the cell flips with a 300ms scale + color-fade transition.

**Wiring:** Use existing draft engine. Front-end submits `POST /api/draft/pick { player_id }` (or whatever the existing endpoint is). The on-the-clock countdown reads from server-supplied `pick_deadline_at`. **Do not** compute pick order client-side; trust the server response. Subscribe to the draft Supabase channel for real-time updates so all drafters see picks as they happen.

### 4.8 Player Pool (route: `pool`)

- Filterable / sortable table of all available (undrafted in current season, or available via add/drop) players.
- Filters: position, MLB team, recent HR pace (last 14 days), ownership status.
- Each row clickable → player detail modal (existing component? or new? — confirm).

**Wiring:** Hits the same player table as the draft room, but with an `is_available` filter that respects current rosters.

### 4.9 Admin Overlay (lock icon → modal)

**4.9.1 PIN gate:**
- Centered card, 380px wide, surface background, 16px radius.
- Eyebrow "RESTRICTED ACCESS" (DM Mono 10px, muted).
- Title "Commissioner" (Bricolage 28px, bone).
- Hint: "League PIN required."
- 4-digit input (mono, large, 0.4em letter-spacing, centered) + "Unlock" button (yellow accent).
- Close (×) top-right.

**Wiring:** **The mock PIN `4242` in the prototype is a placeholder.** The real check should:
- (a) Verify the logged-in user has `is_commissioner = true` (don't even render the lock icon otherwise — see §4.1), AND
- (b) Either re-prompt for the user's password OR check a server-stored `commissioner_pin` (a 4–6 digit code separate from auth password, useful for shared devices). **Confirm with the user which they want.** Do not store the PIN client-side. Verify via `POST /api/admin/unlock { pin }` returning a short-lived signed cookie or session flag.

**4.9.2 Admin shell (after unlock):**
- 880px wide, 88vh max, surface background.
- Header: eyebrow "COMMISSIONER", title "Admin Console".
- Tabs: **Add/Drop** | **Manual HR** | **Season** | **History** | **Danger** (the Danger tab is styled red).
- Status banner (slides in from top when an action succeeds/fails) — green for success, red for error.
- Footer: "Lock console" button (logs out admin session without closing the overlay).

**4.9.3 Add/Drop tab — 3-step picker:**
1. **Pick a team** — grid of team chips, each showing `name` + `adds remaining: N/M` budget.
2. **Pick a player to drop** — 2-column grid of that team's roster, position pill + name + MLB team + season HRs. Click to select (highlighted in `--c-mickey` orange).
3. **Pick a player to add** — text input + position filter (re-uses Player Pool query). Live results below.
4. **Submit** button: `Drop {oldName}, Add {newName}` styled with the team color.

**Wiring:** This is the most server-heavy admin action. The server must:
- Validate the team has an add/drop budget remaining (existing `transactions` count vs `season.max_addrops_per_team`)
- Validate the new player isn't already rostered
- Validate position eligibility
- Atomically: delete old roster row, insert new roster row, insert transaction record, optionally fire SMS to the affected team
- Return the updated roster + budget so the UI can re-render

The prototype is purely client-side; **all of the above happens on the server** and the UI just calls `POST /api/admin/addrop { team_id, drop_player_id, add_player_id }`.

**4.9.4 Manual HR tab:**
- Form: player select (autocomplete by name, scoped to rostered players), exit velocity (number, mph), distance (number, ft), launch angle (number, deg), park (text), notes (text).
- Two action buttons:
  - "Log HR + Send SMS" (yellow primary) → inserts into `home_runs` AND fires the existing SMS pipeline.
  - "Test (no SMS)" (ghost) → dry-run that just inserts the HR but skips Twilio.

**Wiring:** Use the **existing** Twilio integration. There is almost certainly already an `insertHomeRun(hr)` function that fires SMS as a side effect — call it. The "Test" button calls a variant that suppresses SMS. **Do not write a new sender.**

**4.9.5 Season tab:**
- Single config card: "Add/Drop limit per team" with − / number / + stepper, `Save` button.
- Footer text: "Currently set to **N**. Used so far: avg X.X per team."

**Wiring:** `update seasons set max_addrops_per_team = $1 where id = $current_season_id`. If this column doesn't exist, raise it before adding it.

**4.9.6 History tab:**
- Reverse-chronological list of all transactions: date, team, drop player + position → add player + position, optional notes.

**Wiring:** `select * from transactions where season_id = $current order by created_at desc limit 100`. Pagination if needed.

**4.9.7 Danger tab:**
- Red-outline blurb: "These actions cannot be undone."
- Two cards:
  - **Reset Draft** — clears all draft picks for the current season, resets pick clock to round 1 pick 1. Triggers PIN re-prompt before firing.
  - **Wipe Season Data** — clears HRs, transactions, standings snapshots; preserves teams + rosters + draft. Triggers PIN re-prompt before firing.
- Each card requires re-entering the commissioner PIN before the destructive call goes through.
- Success state: green "Done" card replaces the action card.

**Wiring:** Both call `POST /api/admin/danger { action, pin }`. Server re-validates the PIN, performs the destructive transaction in a Postgres transaction block, returns success/error.

---

## 5. Interactions & Behavior

### 5.1 Live HR celebration toast (global)

- When a new HR lands (Supabase realtime insert on `home_runs`), the existing `simulateHR` flow in `shell.jsx` fires:
  - Increments the team's HR count locally (then reconciles with server)
  - Pulses the team's row in the Standings table for 2 seconds
  - Shows a centered toast for 4 seconds with player name, team color stripe, "DINGER" text, and the stat line
- The toast intensity (sound, screen shake, confetti) is controlled by a tweak variable in the prototype — in production, expose it as a per-user setting in their profile.

### 5.2 Real-Time playback (Race + H2H)

- Static is the default mode. Toggle persists per-user in `localStorage` (or a profile column).
- Play/pause, scrubber, speed buttons. Speed = how many simulated hours pass per real second (1× = realtime-ish for replays, 8× for "show me the season fast").
- When the playhead reaches the end, auto-pause (don't loop).

### 5.3 Draft pick animation

- 300ms cell flip + color settle. Don't queue picks — render server state.

### 5.4 Admin status banner

- 200ms slide-in from the top of the admin body, auto-dismiss after 4s.
- Green for success, red for error. Includes the operation name + outcome.

### 5.5 Animation timings (general)

- Hover transitions: 120ms
- Mode toggle: 150ms
- Modal entrance: 240ms `cubic-bezier(0.2, 0.9, 0.3, 1)`
- Live pulses: 2s loop

---

## 6. Data Field Mapping (prototype → real schema)

> Read the actual schema first; this is a guess based on the prototype shape. Adjust as needed.

| Prototype field (in `data.jsx`) | Likely real column |
|---|---|
| `team.id` | `teams.id` |
| `team.name`, `team.color`, `team.short` | `teams.name`, `teams.brand_color`, `teams.short_code` |
| `team.hrs` | computed: `count(home_runs where team_id = teams.id)` |
| `team.budget` (add/drops remaining) | `season.max_addrops_per_team` − `count(transactions where team_id = teams.id and season_id = current)` |
| `player.id`, `player.name`, `player.mlb`, `player.pos` | `players.*` |
| `player.hrs` | `count(home_runs where player_id = ...)` |
| `hr.player`, `hr.team`, `hr.ev`, `hr.dist`, `hr.angle`, `hr.park`, `hr.timestamp` | `home_runs.*` (column names probably differ — check schema) |
| `pick.round`, `pick.pickInRound`, `pick.team`, `pick.player` | `draft_picks.*` |
| `HOURLY_EVENTS` (synthetic) | derived from `home_runs.hit_at` aggregated by hour |
| Mock PIN `4242` | `commissioner_pin` column or auth re-prompt — **decide with user** |

**Action item:** Open the existing schema, fill this table out for real, and commit it as `design_handoff_dingers_please/SCHEMA_MAPPING.md` once confirmed.

---

## 7. Design Tokens

Pulled from `styles.css` `:root`. Reuse via Tailwind theme extension or CSS custom properties — match the codebase's convention.

### Colors
| Token | Value | Use |
|---|---|---|
| `--c-bg` | `#0A0E0C` | App background (near-black green) |
| `--c-surface` | `#101614` | Cards, panels |
| `--c-surfaceHi` | `#161F1B` | Inset surfaces, inputs |
| `--c-border` | `#1F2A24` | Default border |
| `--c-borderHi` | `#2D3A33` | Hover border |
| `--c-text` | `#F2EDE0` | Primary text (bone) |
| `--c-textMuted` | `#7A8B82` | Secondary text |
| `--c-textDim` | `#4A5A52` | Tertiary / disabled |
| `--c-accent` | `#F5C518` | Brand yellow (live, primary CTA) |
| `--c-accentHot` | `#FFD23F` | Yellow hover |
| `--c-diamond` | `#1B5E3F` | Field green |
| `--c-foul` | `#C8312A` | Danger red, foul-line accent |
| `--c-bone` | `#F2EDE0` | Display bone |
| `--c-legit` | `#5BC272` | Live / positive green |
| `--c-mickey` | `#E8693C` | Elite-HR orange |

### Typography
| Token | Value | Use |
|---|---|---|
| Display | `Bricolage Grotesque` 800, letter-spacing -0.02em | Page titles, hero numbers, brand mark |
| UI | `Geist` (fallback `Inter`) | Body, buttons, labels |
| Mono | `DM Mono` | Stats, timestamps, glyphs, eyebrows |
| Digital | `Doto` | Optional: scoreboard-style large numerals |

### Spacing / radius / shadow

- Base spacing: 4px
- Card radius: 12px (large), 8px (medium), 6px (small)
- Pill radius: 999px
- No box-shadows on interior surfaces; rely on borders. Modals use `backdrop-filter: blur(6px)` over `rgba(0,0,0,0.7)`.

---

## 8. Open questions to resolve before coding

1. **PIN strategy:** server-stored `commissioner_pin` column, or re-prompt for the user's auth password? The prototype hardcodes `4242` — that must not ship.
2. **Hourly granularity:** does `home_runs.hit_at` already store sub-hour timestamps? Needed for The Race / H2H Real-Time mode. If not, decide: add the column, or coarsen the prototype to daily granularity.
3. **`max_addrops_per_team`:** is there already a season-level config column for this? If not, add it before wiring the Season admin tab.
4. **SMS dry-run:** does the existing `insertHomeRun()` function support a `skipSms: true` flag for the "Test" button on the Manual HR tab? If not, add it (don't fork the whole sender).
5. **Player pool ownership filter:** confirm whether the schema has a clean "available players" query, or whether we need to compute it from `players LEFT JOIN rosters`.

---

## 9. Files to read first in the existing codebase

In rough order, before writing any UI:

1. `package.json` — confirm Next.js version, Tailwind, component library
2. `supabase/migrations/*` or `prisma/schema.prisma` or `db/schema.ts` — the real schema
3. Existing API routes — `app/api/**` or `pages/api/**` — find draft, HR ingestion, SMS
4. Existing components — find the design-system primitives already in use (Button, Card, Modal, etc.) and **use them**
5. The Twilio sender file — confirm signature so you can call it from the Manual HR endpoint
6. Auth setup — confirm where `is_commissioner` lives

---

## 10. Implementation order suggestion

1. **Read schema + existing endpoints, fill in §6 mapping table.**
2. Top bar + nav skeleton, route stubs.
3. Standings (read-heavy, easy first win, exercises live HR subscription).
4. Rosters + Draft Room (mostly reads + one write per pick).
5. The Race + H2H Static mode (aggregate query → SVG paths).
6. Spray + Pool.
7. The Race + H2H Real-Time mode (timeline scrubber + interpolation).
8. Admin: PIN gate → Add/Drop → Manual HR → Season → History → Danger (in that order, lowest-stakes first).
9. Live HR celebration toast wired to Supabase realtime.
10. Polish: animations, hover states, empty states, error states.

---

## 11. What's deliberately NOT in this design

- No mobile / responsive layouts. The league is small and desktop-first; ask the user before designing mobile.
- No login / signup screens. Reuse what exists.
- No public landing page or marketing.
- No email digest / scheduled newsletters.
- No tweaks panel in production (designer-only).

If the user asks for any of these later, they're follow-up scope.
