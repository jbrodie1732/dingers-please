// update-mlb-teams.js
// Updates mlb_team on all players in the DB using the 2026 spring training roster CSV.
// Only updates players we can match by name — unmatched players keep their existing team.
//
// Usage: node src/scripts/update-mlb-teams.js
//        node src/scripts/update-mlb-teams.js --dry-run   (preview without writing)

require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const { parse } = require('csv-parse/sync');
const chalk   = require('chalk');
const { supabase } = require('../db/client');

const DRY_RUN = process.argv.includes('--dry-run');
const CSV_PATH = path.join(__dirname, '../../data/mlb_26_teams.csv');

// Strip diacritics, lowercase, collapse whitespace, normalize punctuation
function normalize(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // remove diacritics
    .toLowerCase()
    .replace(/['.,-]/g, '')             // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log(chalk.bold(`\n🔄  Update MLB Teams${DRY_RUN ? ' (DRY RUN)' : ''}\n`));

  // 1. Load the new CSV (handle BOM from Excel exports)
  const raw  = fs.readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, '');
  const rows = parse(raw, { columns: true, skip_empty_lines: true });
  console.log(`Loaded ${rows.length} players from mlb_26_teams.csv`);

  // Build normalized name → team map
  // Some entries have "CWS,MIL" style values — take the first team only
  const csvMap = new Map();
  for (const row of rows) {
    const key  = normalize(row.Name);
    const parts = (row.Tm || '').split(',');
    const team  = (parts.length > 1 ? parts[1] : parts[0]).trim(); // second team if multiple (most recent destination)
    if (key && team) csvMap.set(key, team);
  }
  console.log(`  ${csvMap.size} unique normalized names in CSV\n`);

  // 2. Load all players from DB
  const { data: players, error } = await supabase
    .from('players')
    .select('id, name, mlb_team')
    .order('name');

  if (error) { console.error(chalk.red('DB error:', error.message)); process.exit(1); }
  console.log(`Loaded ${players.length} players from DB\n`);

  // 3. Match and build updates
  const updates   = [];
  const matched   = [];
  const unmatched = [];

  for (const player of players) {
    const key    = normalize(player.name);
    const newTeam = csvMap.get(key);

    if (newTeam) {
      if (newTeam !== player.mlb_team) {
        updates.push({ id: player.id, name: player.name, old: player.mlb_team, new: newTeam });
      }
      matched.push(player.name);
    } else {
      unmatched.push(player.name);
    }
  }

  console.log(chalk.green(`✅ Matched:   ${matched.length}`));
  console.log(chalk.yellow(`⚠️  Unmatched: ${unmatched.length} (keeping existing team)`));
  console.log(chalk.blue(`📝 Updates:   ${updates.length} team changes\n`));

  if (updates.length > 0) {
    console.log(chalk.bold('Changes:'));
    for (const u of updates) {
      console.log(`  ${u.name.padEnd(30)} ${chalk.red((u.old || '—').padEnd(6))} → ${chalk.green(u.new)}`);
    }
    console.log('');
  }

  if (unmatched.length > 0 && unmatched.length <= 50) {
    console.log(chalk.bold('Unmatched players (keeping old team):'));
    for (const name of unmatched) console.log(chalk.gray(`  ${name}`));
    console.log('');
  } else if (unmatched.length > 50) {
    console.log(chalk.gray(`(${unmatched.length} unmatched — run with --dry-run to see full list)\n`));
  }

  if (DRY_RUN) {
    console.log(chalk.yellow('Dry run — no changes written.'));
    return;
  }

  if (updates.length === 0) {
    console.log('No team changes needed.');
    return;
  }

  // 4. Apply updates in batches
  let applied = 0;
  for (const u of updates) {
    const { error: upErr } = await supabase
      .from('players')
      .update({ mlb_team: u.new })
      .eq('id', u.id);
    if (upErr) {
      console.error(chalk.red(`  Error updating ${u.name}: ${upErr.message}`));
    } else {
      applied++;
    }
  }

  console.log(chalk.bold.green(`\n✅ Done. Updated ${applied}/${updates.length} players.`));
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
