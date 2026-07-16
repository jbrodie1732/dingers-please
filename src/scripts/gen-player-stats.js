// src/scripts/gen-player-stats.js
//
// Reads the "team_stats" tab of data/dingers_player_data.xlsx and emits
// web/src/lib/playerStats.json — a static, per-player snapshot of the seven
// advanced Statcast metrics the Rosters-page radar chart plots.
//
// These are display-only metrics (like mlb_team / preseason_hrs), NOT in-pool
// scoring data, so they deliberately live as a bundled JSON in the web app
// rather than as columns in Supabase — no migration, no loader change. Re-run
// this whenever the workbook's team_stats tab changes (e.g. after the final
// draft picks land, or an add/drop replacement):
//
//   node src/scripts/gen-player-stats.js
//
// The JSON is keyed by mlb_player_id (the same numeric MLB Statcast id stored
// on players.mlb_player_id), which is how the web app joins each rostered
// player to its stats.

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const WORKBOOK_PATH = path.join(__dirname, '../../data/dingers_player_data.xlsx');
const SHEET_NAME = 'team_stats';
const OUT_PATH = path.join(__dirname, '../../web/src/lib/playerStats.json');

// The seven radar metrics. Order here is the canonical axis order used by the
// chart. All are "higher = better". `key` is the column header in the sheet;
// `label` is the axis label shown in the UI; `fmt` controls tooltip display.
const METRICS = [
  { key: 'exp_home_run',       label: 'xHR (2026 YTD)',   fmt: 'num1' },
  { key: 'hr_per_4_pa',        label: 'HR / 4 PA',        fmt: 'num2' },
  { key: 'avg_swing_speed',    label: 'Swing Speed',      fmt: 'num1' },
  { key: 'launch_angle_avg',   label: 'Launch Angle',     fmt: 'num1' },
  { key: 'no_doubter_per',     label: 'No-Doubter %',     fmt: 'pct'  },
  { key: 'exit_velocity_avg',  label: 'Exit Velo',        fmt: 'num1' },
  { key: 'barrel_batted_rate', label: 'Barrel %',         fmt: 'pct'  },
];

function main() {
  if (!fs.existsSync(WORKBOOK_PATH)) {
    throw new Error(`Workbook not found at ${WORKBOOK_PATH}`);
  }

  const wb = XLSX.readFile(WORKBOOK_PATH);
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) {
    throw new Error(
      `Sheet "${SHEET_NAME}" not found in ${WORKBOOK_PATH} (found: ${wb.SheetNames.join(', ')})`
    );
  }

  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

  const stats = {};
  let ok = 0;
  const skipped = [];

  for (const r of rows) {
    const mlbId = r.player_id;
    if (mlbId == null || r.Name == null) {
      skipped.push(r);
      continue;
    }

    const entry = { name: String(r.Name) };
    let hasAny = false;
    for (const m of METRICS) {
      const v = r[m.key];
      const num = v == null || v === '' ? null : Number(v);
      entry[m.key] = Number.isFinite(num) ? num : null;
      if (entry[m.key] != null) hasAny = true;
    }

    if (!hasAny) {
      skipped.push(r);
      continue;
    }

    stats[Number(mlbId)] = entry;
    ok++;
  }

  const payload = {
    _generatedAt: new Date().toISOString(),
    _source: `${path.basename(WORKBOOK_PATH)} :: ${SHEET_NAME}`,
    metrics: METRICS,
    players: stats,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + '\n');

  console.log(`Wrote ${ok} players to ${path.relative(process.cwd(), OUT_PATH)}`);
  if (skipped.length) {
    console.log(`Skipped ${skipped.length} row(s) missing id/name/stats.`);
  }
}

main();
