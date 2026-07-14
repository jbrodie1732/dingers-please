// draft.js — Interactive snake draft CLI
// Run: node src/scripts/draft.js
//
// Before running:
//   1. Edit config/draft.config.js with your teams in draft order
//   2. Make sure data/dingers_player_data.xlsx exists (MAIN tab = player pool)
//   3. Make sure your .env is configured with Supabase credentials
//
// NOTE: the real draft-day flow for this league happens on the web app's
// /draft page (see OPERATIONS.md) — this CLI is kept as an alternate/offline
// path and reads from the same workbook as load-player-pool.js.

require('dotenv').config();
const inquirer = require('inquirer');
const chalk    = require('chalk');
const { upsertTeam, insertPlayer, insertDraftPick, getAllTeams } = require('../db/queries');
const { loadPlayerPool, WORKBOOK_PATH } = require('../lib/playerData');

const DRAFT_CFG = require('../../config/draft.config');

const { teams: TEAM_NAMES, rounds: ROUNDS, positions: POSITIONS, season: SEASON } = DRAFT_CFG;

// ---- Load position eligibility from the player data workbook ----
function loadPositions() {
  let players;
  try {
    ({ players } = loadPlayerPool());
  } catch (err) {
    console.error(chalk.red(`\n❌ Could not load player data: ${err.message}`));
    console.error(chalk.yellow(`Expected workbook at ${WORKBOOK_PATH}\n`));
    process.exit(1);
  }
  const map = new Map();
  for (const p of players) {
    map.set(p.name.toLowerCase(), {
      name:             p.name,
      primary_position: p.position,
      mlb_team:         p.mlb_team,
      mlb_player_id:    p.mlb_player_id,
    });
  }
  return map;  // Map<lowercaseName, { name, primary_position, mlb_team, mlb_player_id }>
}

// ---- Snake draft order ----
function buildPickOrder(teamCount, rounds) {
  const picks = [];
  for (let r = 1; r <= rounds; r++) {
    const isSnake = r % 2 === 0;
    const order   = isSnake ? [...Array(teamCount).keys()].reverse() : [...Array(teamCount).keys()];
    for (const i of order) {
      picks.push({ round: r, teamIndex: i, pickInRound: isSnake ? teamCount - order.indexOf(i) : i + 1 });
    }
  }
  return picks;
}

// ---- Display helpers ----
function printBoard(rosters, teamNames) {
  console.log('\n' + chalk.bold('━'.repeat(60)));
  console.log(chalk.bold('CURRENT ROSTERS'));
  console.log('━'.repeat(60));
  for (const [teamName, roster] of Object.entries(rosters)) {
    const filled  = Object.keys(roster).filter(p => p !== '__meta').join(', ') || 'none';
    const missing = POSITIONS.filter(p => !roster[p]);
    console.log(`${chalk.cyan(teamName.padEnd(10))} | Have: ${chalk.green(filled || 'nothing yet')}`);
    if (missing.length) {
      console.log(`${' '.repeat(10)} | Need: ${chalk.yellow(missing.join(', '))}`);
    }
  }
  console.log('━'.repeat(60) + '\n');
}

async function main() {
  console.log(chalk.bold.green('\n🏈  DINGER TRACKER DRAFT ' + SEASON));
  console.log(chalk.gray(`${TEAM_NAMES.length} teams · ${ROUNDS} rounds · Positions: ${POSITIONS.join(', ')}\n`));

  const positions  = loadPositions();
  const picks      = buildPickOrder(TEAM_NAMES.length, ROUNDS);
  const totalPicks = picks.length;

  // Upsert all teams into Supabase and build name→id map
  const teamIdMap = {};
  for (const name of TEAM_NAMES) {
    const team       = await upsertTeam(name);
    teamIdMap[name]  = team.id;
  }
  console.log(chalk.green(`✅ ${TEAM_NAMES.length} teams ready in DB\n`));

  // Track rosters in memory: { teamName: { C: 'Cal Raleigh', 1B: null, ... } }
  const rosters = {};
  for (const name of TEAM_NAMES) {
    rosters[name] = Object.fromEntries(POSITIONS.map(p => [p, null]));
  }

  const drafted = new Set();  // lowercase player names
  let overallPick = 0;

  for (const pick of picks) {
    overallPick++;
    const teamName = TEAM_NAMES[pick.teamIndex];
    const roster   = rosters[teamName];
    const openSlots = POSITIONS.filter(p => !roster[p]);

    if (openSlots.length === 0) {
      console.log(chalk.gray(`${teamName} has no open slots — skipping (shouldn't happen)`));
      continue;
    }

    console.log(chalk.bold(`\nPick ${overallPick}/${totalPicks} — Round ${pick.round}, Pick ${pick.pickInRound}`));
    console.log(chalk.cyan(`🎯  ${teamName.toUpperCase()}'s turn`));
    console.log(chalk.yellow(`   Open slots: ${openSlots.join(', ')}`));

    let confirmed = false;
    while (!confirmed) {
      const { rawInput } = await inquirer.prompt([{
        type:    'input',
        name:    'rawInput',
        message: 'Enter player name (or "skip" to skip, "board" to see rosters):',
      }]);

      const input = rawInput.trim();

      if (input.toLowerCase() === 'board') {
        printBoard(rosters, TEAM_NAMES);
        continue;
      }
      if (input.toLowerCase() === 'skip') {
        console.log(chalk.gray('Pick skipped.'));
        confirmed = true;
        continue;
      }
      if (!input) continue;

      // Look up player in positions CSV
      const key    = input.toLowerCase();
      const player = positions.get(key)
        || [...positions.values()].find(p => p.name.toLowerCase().includes(key));

      if (!player) {
        console.log(chalk.red(`  Player "${input}" not found in positions data.`));
        console.log(chalk.gray('  Try a different spelling, or check data/dingers_player_data.xlsx.'));
        continue;
      }

      if (drafted.has(player.name.toLowerCase())) {
        console.log(chalk.red(`  ${player.name} was already drafted!`));
        continue;
      }

      const pos = player.primary_position;
      if (!POSITIONS.includes(pos)) {
        console.log(chalk.red(`  ${player.name}'s position (${pos}) is not a valid draft position.`));
        continue;
      }
      if (roster[pos]) {
        console.log(chalk.red(`  ${teamName} already has a ${pos}: ${roster[pos]}`));
        continue;
      }

      console.log(chalk.green(`\n  Found: ${player.name} | Position: ${pos} | MLB Team: ${player.mlb_team}`));
      const { confirm } = await inquirer.prompt([{
        type:    'confirm',
        name:    'confirm',
        message: `Draft ${player.name} (${pos}) for ${teamName}?`,
        default: true,
      }]);

      if (!confirm) continue;

      // Write to DB
      try {
        const playerRow = await insertPlayer({
          name:          player.name,
          team_id:       teamIdMap[teamName],
          position:      pos,
          mlb_player_id: player.mlb_player_id ?? null,
          mlb_team:      player.mlb_team ?? null,
        });
        await insertDraftPick({
          season:        SEASON,
          round:         pick.round,
          pick_in_round: pick.pickInRound,
          overall_pick:  overallPick,
          player_id:     playerRow.id,
          team_id:       teamIdMap[teamName],
        });

        roster[pos] = player.name;
        drafted.add(player.name.toLowerCase());
        console.log(chalk.bold.green(`  ✅ ${player.name} → ${teamName} (${pos})`));
        confirmed = true;
      } catch (err) {
        console.error(chalk.red(`  DB error: ${err.message}`));
      }
    }
  }

  console.log(chalk.bold.green('\n🎉  Draft complete!\n'));
  printBoard(rosters, TEAM_NAMES);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
