// src/lib/playerData.js
//
// Shared reader for data/dingers_player_data.xlsx — the pre-season player
// pool source of truth (replaces the old data/positions.csv + fetch-positions.js
// scrape + fetch-mlb-ids.js post-draft ID-matching flow).
//
// The "MAIN" tab already contains everything the draft/load scripts need:
//   Rk               — rank (unused here)
//   mlb_player_ID    — official MLB Statcast player ID (→ players.mlb_player_id)
//   mlb_statcast_name— official MLB Statcast naming convention (→ players.mlb_api_name)
//   Baseball Ref Name— (unused here)
//   DraftBuddy Name  — display/draft name (→ players.name)
//   Team             — MLB team abbreviation, has a trailing non-breaking
//                       space in the source sheet (→ players.mlb_team)
//   HR               — real-season home run count as of the snapshot
//                       (→ players.preseason_hrs — informational only, distinct
//                       from the in-pool `total_hrs` tracked after draft)
//   Pos              — primary position, matches the players.position CHECK
//                       constraint values exactly (C,1B,2B,3B,SS,LF,CF,RF,DH)
//   Tie              — unused here

const path = require('path');
const XLSX = require('xlsx');

const WORKBOOK_PATH = path.join(__dirname, '../../data/dingers_player_data.xlsx');
const SHEET_NAME     = 'MAIN';

// Strips the stray non-breaking space (and any other whitespace) the source
// sheet has after every team abbreviation, e.g. "PHI " -> "PHI".
function cleanTeam(team) {
  if (!team) return null;
  const cleaned = String(team).replace(/[\s ]+/g, '');
  return cleaned || null;
}

// Reads the MAIN tab and returns a de-duplicated array of normalized player
// rows: { name, mlb_player_id, mlb_api_name, mlb_team, position, preseason_hrs }.
//
// A couple of rows in the source sheet share the same mlb_player_id (e.g. a
// duplicate "Max Muncy" entry) — when that happens we keep whichever row has
// the higher preseason_hrs value and drop the other, so downstream unique
// constraints on players.name / mlb_player_id don't choke on it.
function loadPlayerPool() {
  if (!require('fs').existsSync(WORKBOOK_PATH)) {
    throw new Error(`Workbook not found at ${WORKBOOK_PATH}`);
  }

  const wb = XLSX.readFile(WORKBOOK_PATH);
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) {
    throw new Error(`Sheet "${SHEET_NAME}" not found in ${WORKBOOK_PATH} (found: ${wb.SheetNames.join(', ')})`);
  }

  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: null });

  const byMlbId = new Map();
  const skipped = [];

  for (const r of rawRows) {
    const mlbId = r.mlb_player_ID;
    const name  = r['DraftBuddy Name'];
    const pos   = r.Pos;

    if (!mlbId || !name || !pos) {
      skipped.push(r);
      continue;
    }

    const row = {
      name,
      mlb_player_id: Number(mlbId),
      mlb_api_name:  r.mlb_statcast_name || null,
      mlb_team:      cleanTeam(r.Team),
      position:      pos,
      preseason_hrs: Number(r.HR) || 0,
    };

    const existing = byMlbId.get(row.mlb_player_id);
    if (!existing || row.preseason_hrs > existing.preseason_hrs) {
      byMlbId.set(row.mlb_player_id, row);
    }
  }

  return { players: [...byMlbId.values()], skipped };
}

module.exports = { loadPlayerPool, WORKBOOK_PATH, SHEET_NAME };
