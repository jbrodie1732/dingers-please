// load-injuries.js
//
// One-time sync of the "injuries" tab in data/dingers_player_data.xlsx into
// Supabase. The tab lists every player MLB currently has on the injured
// list — anyone NOT on this tab is treated as healthy, so every run first
// clears il_status/injury_detail/injury_update on all players, then
// re-populates it from whatever's currently in the sheet.
//
// Tab columns: Name, Match Name, Player ID, Status, Injury / Surgery, Latest Update
// Matched against players.mlb_player_id (== "Player ID").
//
// Re-run any time the "injuries" tab is updated:
//   node src/scripts/load-injuries.js

require('dotenv').config();
const path = require('path');
const XLSX = require('xlsx');
const { supabase } = require('../db/client');

const WORKBOOK_PATH = path.join(__dirname, '../../data/dingers_player_data.xlsx');
const SHEET_NAME = 'injuries';

async function main() {
  console.log('🩹 Syncing injury statuses into Supabase...\n');

  const wb = XLSX.readFile(WORKBOOK_PATH);
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) {
    throw new Error(`Sheet "${SHEET_NAME}" not found in ${WORKBOOK_PATH} (found: ${wb.SheetNames.join(', ')})`);
  }

  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

  // 1. Clear existing injury data on every player — anyone not in this
  //    sheet's list is, by definition, not currently injured.
  const { error: clearErr } = await supabase
    .from('players')
    .update({ il_status: null, injury_detail: null, injury_update: null })
    .not('id', 'is', null); // match-all guard required by supabase-js for bulk update
  if (clearErr) throw new Error(`Clear failed: ${clearErr.message}`);

  // 2. Apply current injuries by mlb_player_id.
  let updated = 0;
  const unmatched = [];
  for (const r of rows) {
    const mlbId = r['Player ID'];
    const status = r['Status'];
    if (!mlbId || !status) continue;

    const { data, error } = await supabase
      .from('players')
      .update({
        il_status:     status,
        injury_detail: r['Injury / Surgery'] || null,
        injury_update: r['Latest Update'] || null,
      })
      .eq('mlb_player_id', Number(mlbId))
      .select('id');

    if (error) {
      console.error(`  Error updating ${r['Name']} (${mlbId}):`, error.message);
      continue;
    }
    if (!data || data.length === 0) {
      unmatched.push(`${r['Name']} (mlb_player_id ${mlbId})`);
    } else {
      updated += data.length;
    }
  }

  console.log(`  ✅ ${updated} player(s) marked injured`);
  if (unmatched.length) {
    console.log(`  ⚠️  ${unmatched.length} injured player(s) not found in players table (not in this season's pool):`);
    for (const u of unmatched) console.log(`     - ${u}`);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
