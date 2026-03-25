// fetch-mlb-ids.js
// Run AFTER the draft to populate mlb_player_id for every drafted player.
// The watcher then matches by numeric ID (reliable) instead of name (fragile).
//
// Usage:
//   node src/scripts/fetch-mlb-ids.js          # dry run (shows matches, no DB writes)
//   node src/scripts/fetch-mlb-ids.js --save    # write IDs to Supabase

require('dotenv').config();
const axios   = require('axios');
const chalk   = require('chalk');
const { supabase } = require('../db/client');

const SAVE    = process.argv.includes('--save');
const MLB_URL = 'https://statsapi.mlb.com/api/v1';

// ---- Normalize a name for fuzzy comparison ----
// Strips accents, lowercases, removes Jr./Sr./II/III, trims punctuation
function normalize(name = '') {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[.,]/g, '')                              // remove periods/commas
    .replace(/\b(jr|sr|ii|iii|iv)\b/gi, '')           // remove suffixes
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function nameSimilarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1.0;
  // Check if one contains the other (handles middle names etc.)
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  // Check last-name match
  const lastA = na.split(' ').pop();
  const lastB = nb.split(' ').pop();
  if (lastA === lastB) return 0.7;
  return 0;
}

async function fetchAllMLBPlayers(season = 2026) {
  console.log(`Fetching MLB roster for ${season}...`);
  const { data } = await axios.get(`${MLB_URL}/sports/1/players`, {
    params: { season, fields: 'people,id,fullName,currentTeam,primaryPosition' },
    timeout: 15000,
  });
  return data.people || [];
}

async function main() {
  console.log(chalk.bold(`\n🔍 MLB ID Lookup ${SAVE ? '(SAVING)' : '(dry run — add --save to write)'}\n`));

  // Load drafted players from DB
  const { data: players, error } = await supabase
    .from('players')
    .select('id, name, position, mlb_player_id, teams(name)')
    .not('team_id', 'is', null)
    .order('name');

  if (error) { console.error('DB error:', error.message); process.exit(1); }
  console.log(`${players.length} drafted players loaded from DB\n`);

  const mlbPlayers = await fetchAllMLBPlayers();
  console.log(`${mlbPlayers.length} MLB players fetched\n`);

  const results = { matched: [], ambiguous: [], notFound: [] };

  for (const player of players) {
    if (player.mlb_player_id) {
      console.log(chalk.gray(`  SKIP  ${player.name} (ID already set: ${player.mlb_player_id})`));
      continue;
    }

    // Score every MLB player against this player's name
    const scored = mlbPlayers
      .map(mlb => ({ mlb, score: nameSimilarity(player.name, mlb.fullName) }))
      .filter(r => r.score >= 0.7)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      results.notFound.push(player);
      console.log(chalk.red(`  ✗     ${player.name} — NO MATCH FOUND`));
    } else if (scored[0].score === 1.0 || (scored.length === 1 && scored[0].score >= 0.9)) {
      const best = scored[0].mlb;
      results.matched.push({ player, mlb: best });
      const tag = best.fullName !== player.name
        ? chalk.yellow(` (API name: "${best.fullName}")`)
        : '';
      console.log(chalk.green(`  ✓     ${player.name} → ID ${best.id}${tag}`));
    } else {
      // Multiple plausible matches — flag for manual review
      results.ambiguous.push({ player, candidates: scored.slice(0, 3).map(r => r.mlb) });
      console.log(chalk.yellow(`  ?     ${player.name} — multiple candidates:`));
      scored.slice(0, 3).forEach(r => {
        console.log(chalk.yellow(`          ${r.mlb.id} "${r.mlb.fullName}" (score ${r.score.toFixed(1)})`));
      });
    }
  }

  console.log(`\n${chalk.bold('Summary:')}`);
  console.log(`  ✓ Matched:   ${results.matched.length}`);
  console.log(`  ? Ambiguous: ${results.ambiguous.length}`);
  console.log(`  ✗ Not found: ${results.notFound.length}`);

  if (results.ambiguous.length > 0) {
    console.log(chalk.yellow(`\nFor ambiguous players, manually set mlb_player_id and mlb_api_name via:`));
    console.log(chalk.gray(`  node src/scripts/admin.js fix-player-name`));
    console.log(chalk.gray(`  or edit directly in Supabase Table Editor`));
  }

  if (results.notFound.length > 0) {
    console.log(chalk.red(`\nNot-found players need manual lookup. Check spelling or use Supabase Table Editor.`));
    results.notFound.forEach(p => console.log(chalk.red(`  - ${p.name}`)));
  }

  if (!SAVE) {
    console.log(chalk.gray('\n(dry run) Re-run with --save to write to DB'));
    return;
  }

  // Write matched IDs to DB
  let saved = 0;
  for (const { player, mlb } of results.matched) {
    const update = { mlb_player_id: mlb.id };
    // If API name differs, store it so the watcher can match by it too
    if (normalize(mlb.fullName) !== normalize(player.name)) {
      update.mlb_api_name = mlb.fullName;
    }
    const { error: upErr } = await supabase
      .from('players')
      .update(update)
      .eq('id', player.id);
    if (upErr) {
      console.error(chalk.red(`  Failed to update ${player.name}: ${upErr.message}`));
    } else {
      saved++;
    }
  }
  console.log(chalk.green(`\n✅ Saved ${saved} IDs to Supabase`));
}

main().catch(err => { console.error(err); process.exit(1); });
