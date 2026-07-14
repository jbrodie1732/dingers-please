// load-player-pool.js
// Pre-loads all players from data/dingers_player_data.xlsx (MAIN tab) into
// Supabase BEFORE the draft. Also sets draft_position on teams from
// config/draft.config.js.
// Safe to re-run — clears undrafted players and reloads fresh.
//
// Usage: node src/scripts/load-player-pool.js

require('dotenv').config();
const { supabase } = require('../db/client');
const { loadPlayerPool, WORKBOOK_PATH } = require('../lib/playerData');
const DRAFT_CFG = require('../../config/draft.config');

async function main() {
  console.log('🏈 Loading player pool into Supabase...\n');

  // 1. Upsert teams with draft_position
  console.log('Setting up teams with draft order...');
  for (let i = 0; i < DRAFT_CFG.teams.length; i++) {
    const { error } = await supabase
      .from('teams')
      .upsert({ name: DRAFT_CFG.teams[i], draft_position: i + 1 }, { onConflict: 'name' });
    if (error) throw new Error(`Team upsert failed: ${error.message}`);
  }
  console.log(`  ✅ ${DRAFT_CFG.teams.length} teams set\n`);

  // 2. Clear existing undrafted players (safe — preserves anyone already picked)
  const { error: clearErr } = await supabase
    .from('players')
    .delete()
    .is('team_id', null);
  if (clearErr) throw new Error(`Clear failed: ${clearErr.message}`);

  // 3. Parse dingers_player_data.xlsx (MAIN tab)
  const { players: rows, skipped } = loadPlayerPool();
  console.log(`Parsed ${rows.length} players from ${WORKBOOK_PATH}`);
  if (skipped.length) {
    console.log(`  ⚠️  Skipped ${skipped.length} row(s) missing a player ID, name, or position`);
  }

  // 4. Insert in batches of 200 (Supabase row limit per request)
  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map(r => ({
      name:          r.name,
      position:      r.position,
      mlb_team:      r.mlb_team,
      mlb_player_id: r.mlb_player_id,
      mlb_api_name:  r.mlb_api_name,
      preseason_hrs: r.preseason_hrs,
      team_id:       null,
    }));
    // ignoreDuplicates = true: skip if player somehow already exists (drafted)
    const { error } = await supabase
      .from('players')
      .upsert(batch, { onConflict: 'name', ignoreDuplicates: true });
    if (error) {
      console.error(`  Batch ${i}–${i + BATCH} error:`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`  ✅ ${inserted} players loaded\n`);
  console.log('Player pool is ready. Open /draft to start the draft.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
