// load-player-pool.js
// Pre-loads all players from data/positions.csv into Supabase BEFORE the draft.
// Also sets draft_position on teams from config/draft.config.js.
// Safe to re-run — clears undrafted players and reloads fresh.
//
// Usage: node src/scripts/load-player-pool.js

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { supabase } = require('../db/client');
const DRAFT_CFG = require('../../config/draft.config');

const POSITIONS_CSV = path.join(__dirname, '../../data/positions.csv');

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

  // 3. Parse positions.csv
  const raw  = fs.readFileSync(POSITIONS_CSV, 'utf8');
  const rows = parse(raw, { columns: true, skip_empty_lines: true });
  console.log(`Parsed ${rows.length} players from positions.csv`);

  // 4. Insert in batches of 200 (Supabase row limit per request)
  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map(r => ({
      name:     r.name,
      position: r.primary_position,
      team_id:  null,
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
