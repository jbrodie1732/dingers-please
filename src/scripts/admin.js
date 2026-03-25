// admin.js — Quick fixes for common data issues
// Usage: node src/scripts/admin.js <command>
//
// Commands:
//   fix-player-name   — correct a player's name or set their MLB API name override
//   fix-hr-distance   — manually set a home run's distance
//   set-add-drop-limit — update the season-wide add/drop limit
//   show-mismatches   — list any HR batter IDs that don't match a drafted player

require('dotenv').config();
const inquirer = require('inquirer');
const chalk    = require('chalk');
const { supabase } = require('../db/client');

const COMMANDS = [
  { name: 'fix-player-name    — correct name / set MLB API name override', value: 'fix-player-name' },
  { name: 'fix-hr-distance    — manually update a HR distance', value: 'fix-hr-distance' },
  { name: 'set-add-drop-limit — change the season add/drop limit', value: 'set-add-drop-limit' },
  { name: 'show-roster        — dump current rosters + HRs per player', value: 'show-roster' },
  { name: 'show-transactions  — list all add/drop transactions', value: 'show-transactions' },
  { name: 'reset-draft        — wipe all draft picks and unassign all players', value: 'reset-draft' },
];

async function fixPlayerName() {
  const { data: players } = await supabase
    .from('players')
    .select('id, name, mlb_player_id, mlb_api_name, position, teams(name)')
    .order('name');

  const { playerName } = await inquirer.prompt([{
    type: 'list', name: 'playerName',
    message: 'Which player needs fixing?',
    choices: players.map(p => ({
      name: `${p.name} (${p.position}, ${p.teams?.name}) ${p.mlb_player_id ? `[ID: ${p.mlb_player_id}]` : '[no ID]'}`,
      value: p.name,
    })),
  }]);
  const player = players.find(p => p.name === playerName);

  console.log(chalk.gray(`\nCurrent: name="${player.name}" | mlb_api_name="${player.mlb_api_name || 'not set'}" | mlb_player_id=${player.mlb_player_id || 'not set'}`));

  const answers = await inquirer.prompt([
    { type: 'input', name: 'name', message: `Display name (blank = keep "${player.name}"):` },
    { type: 'input', name: 'mlb_api_name', message: `MLB API name override (blank = keep):`, default: player.mlb_api_name || '' },
    { type: 'input', name: 'mlb_player_id', message: `MLB player ID (blank = keep):`, default: player.mlb_player_id?.toString() || '' },
  ]);

  const update = {};
  if (answers.name.trim())        update.name           = answers.name.trim();
  if (answers.mlb_api_name !== (player.mlb_api_name || '')) update.mlb_api_name = answers.mlb_api_name || null;
  if (answers.mlb_player_id && answers.mlb_player_id !== (player.mlb_player_id?.toString() || '')) {
    update.mlb_player_id = parseInt(answers.mlb_player_id);
  }

  if (Object.keys(update).length === 0) {
    console.log('No changes.'); return;
  }

  const { error } = await supabase.from('players').update(update).eq('id', player.id);
  if (error) { console.error(chalk.red('Error:', error.message)); return; }
  console.log(chalk.green(`✅ Updated ${player.name}`), update);
  console.log(chalk.yellow('Restart the watcher to apply the new name/ID.'));
}

async function fixHrDistance() {
  // Show recent HRs without distance or with suspiciously round numbers
  const { data: hrs } = await supabase
    .from('home_runs')
    .select('id, game_date, distance, players(name)')
    .order('hit_at', { ascending: false })
    .limit(50);

  const { hrChoice } = await inquirer.prompt([{
    type: 'list', name: 'hrChoice',
    message: 'Which home run needs a distance fix?',
    choices: hrs.map(hr => ({
      name: `${hr.game_date} — ${hr.players?.name} — ${hr.distance != null ? hr.distance + ' ft' : 'NO DISTANCE'}`,
      value: hr.id,
    })),
  }]);

  const { dist } = await inquirer.prompt([{
    type: 'input', name: 'dist',
    message: 'Enter correct distance in feet (integer):',
    validate: v => !isNaN(parseInt(v)) ? true : 'Must be a number',
  }]);

  const { error } = await supabase
    .from('home_runs')
    .update({ distance: parseInt(dist) })
    .eq('id', hrChoice);

  if (error) { console.error(chalk.red('Error:', error.message)); return; }
  console.log(chalk.green(`✅ Distance updated to ${dist} ft`));
}

async function setAddDropLimit() {
  const { data: cfg } = await supabase
    .from('season_config').select('*').eq('season', 2026).single();

  console.log(chalk.gray(`Current limit: ${cfg?.add_drop_limit ?? 2}`));

  const { limit } = await inquirer.prompt([{
    type: 'input', name: 'limit',
    message: 'New add/drop limit per team:',
    validate: v => !isNaN(parseInt(v)) && parseInt(v) >= 0 ? true : 'Must be a non-negative number',
  }]);

  const { error } = await supabase
    .from('season_config')
    .upsert({ season: 2026, add_drop_limit: parseInt(limit) }, { onConflict: 'season' });

  if (error) { console.error(chalk.red('Error:', error.message)); return; }
  console.log(chalk.green(`✅ Add/drop limit set to ${limit}`));
}

async function showRoster() {
  const { data: standings } = await supabase
    .from('player_standings')
    .select('*')
    .order('team_name')
    .order('total_hrs', { ascending: false });

  if (!standings?.length) { console.log('No players found.'); return; }

  let curTeam = null;
  let teamTotal = 0;
  for (const p of standings) {
    if (p.team_name !== curTeam) {
      if (curTeam) console.log(chalk.bold.yellow(`  TOTAL: ${teamTotal} HRs\n`));
      console.log(chalk.bold.cyan(`\n${p.team_name}`));
      curTeam = p.team_name;
      teamTotal = 0;
    }
    const dropped  = p.is_dropped ? chalk.red(' [DROPPED]') : '';
    const added    = p.added_at   ? chalk.yellow(` [ADDED ${new Date(p.added_at).toLocaleDateString()}]`) : '';
    console.log(`  ${p.position.padEnd(4)} ${p.player_name.padEnd(30)} ${p.total_hrs} HRs${dropped}${added}`);
    teamTotal += p.total_hrs;
  }
  if (curTeam) console.log(chalk.bold.yellow(`  TOTAL: ${teamTotal} HRs\n`));
}

async function showTransactions() {
  const { data: txs } = await supabase
    .from('transactions')
    .select('*, teams(name), dropped:players!dropped_player_id(name), added:players!added_player_id(name)')
    .eq('season', 2026)
    .order('effective_at', { ascending: false });

  if (!txs?.length) { console.log('No transactions yet.'); return; }
  console.log(chalk.bold('\nAdd/Drop History:\n'));
  for (const tx of txs) {
    console.log(`${new Date(tx.effective_at).toLocaleString().padEnd(24)} ${(tx.teams?.name || '?').padEnd(10)} DROP ${tx.dropped?.name} → ADD ${tx.added?.name || '(TBD)'}`);
    if (tx.notes) console.log(chalk.gray(`  Notes: ${tx.notes}`));
  }
}

async function resetDraft() {
  console.log(chalk.red('\n⚠️  This will delete ALL draft picks and unassign ALL players for 2026.'));
  const { confirm } = await inquirer.prompt([{
    type: 'confirm', name: 'confirm',
    message: 'Are you sure?',
    default: false,
  }]);
  if (!confirm) { console.log('Cancelled.'); return; }

  const [{ error: pickErr }, { error: playerErr }] = await Promise.all([
    supabase.from('draft_picks').delete().eq('season', 2026),
    supabase.from('players').update({ team_id: null }).not('id', 'is', null),
  ]);

  if (pickErr || playerErr) {
    console.error(chalk.red('Error:', pickErr?.message ?? playerErr?.message));
    return;
  }
  console.log(chalk.green('✅ Draft reset. All picks deleted, all players unassigned.'));
}

async function main() {
  console.log(chalk.bold('\n🔧  DINGER TRACKER ADMIN\n'));

  const cmdArg = process.argv[2];
  let command = cmdArg;

  if (!command || !COMMANDS.find(c => c.value === command)) {
    const { chosen } = await inquirer.prompt([{
      type: 'list', name: 'chosen',
      message: 'What do you want to do?',
      choices: COMMANDS,
    }]);
    command = chosen;
  }

  if (command === 'fix-player-name')    await fixPlayerName();
  else if (command === 'fix-hr-distance')    await fixHrDistance();
  else if (command === 'set-add-drop-limit') await setAddDropLimit();
  else if (command === 'show-roster')        await showRoster();
  else if (command === 'show-transactions')  await showTransactions();
  else if (command === 'reset-draft')        await resetDraft();
  else console.log(chalk.red(`Unknown command: ${command}`));
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
