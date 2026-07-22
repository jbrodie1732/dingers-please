// add-drop.js — Process a mid-season roster transaction
// Usage: node src/scripts/add-drop.js

require('dotenv').config();
const inquirer = require('inquirer');
const chalk    = require('chalk');
const { supabase } = require('../db/client');

async function getAddDropBudget(teamId, season) {
  const [{ data: config }, { data: used }] = await Promise.all([
    supabase.from('season_config').select('add_drop_limit').eq('season', season).single(),
    supabase.from('transactions').select('id', { count: 'exact' })
      .eq('team_id', teamId).eq('season', season),
  ]);
  const limit = config?.add_drop_limit ?? 2;
  const count = used?.length ?? 0;
  return { limit, used: count, remaining: limit - count };
}

async function main() {
  console.log(chalk.bold('\n🔄  ADD / DROP MANAGER\n'));

  // Load teams and current season config
  const [{ data: teams }, { data: config }] = await Promise.all([
    supabase.from('teams').select('*').order('name'),
    supabase.from('season_config').select('*').eq('season', 2026).single(),
  ]);

  const season      = config?.season ?? 2026;
  const globalLimit = config?.add_drop_limit ?? 2;
  console.log(chalk.gray(`Season: ${season} | Add/drop limit per team: ${globalLimit}\n`));

  // Show each team's remaining budget
  console.log(chalk.bold('Budget remaining:'));
  for (const team of teams) {
    const { limit, used, remaining } = await getAddDropBudget(team.id, season);
    const color = remaining === 0 ? chalk.red : remaining === 1 ? chalk.yellow : chalk.green;
    console.log(`  ${team.name.padEnd(10)} ${color(`${remaining}/${limit} remaining`)}`);
  }
  console.log('');

  // Pick the team making the move
  const { teamName } = await inquirer.prompt([{
    type: 'list', name: 'teamName',
    message: 'Which team is making this move?',
    choices: teams.map(t => t.name),
  }]);
  const team = teams.find(t => t.name === teamName);
  const budget = await getAddDropBudget(team.id, season);

  if (budget.remaining <= 0) {
    console.log(chalk.red(`\n❌ ${teamName} has used all ${budget.limit} add/drops. Cannot proceed.`));
    process.exit(0);
  }
  console.log(chalk.green(`  ${budget.remaining} add/drop(s) remaining for ${teamName}\n`));

  // Load this team's active roster
  const { data: roster } = await supabase
    .from('players')
    .select('id, name, position, total_hrs:player_standings(total_hrs)')
    .eq('team_id', team.id)
    .is('dropped_at', null)
    .order('position');

  console.log(chalk.bold(`Current roster for ${teamName}:`));
  roster?.forEach(p => {
    const hrs = p.total_hrs?.[0]?.total_hrs ?? 0;
    console.log(`  ${p.position.padEnd(4)} ${p.name.padEnd(28)} (${hrs} HRs)`);
  });
  console.log('');

  // Pick player to drop
  const { dropName } = await inquirer.prompt([{
    type: 'list', name: 'dropName',
    message: 'Who are you DROPPING?',
    choices: (roster || []).map(p => ({
      name: `${p.position} — ${p.name}`,
      value: p.name,
    })),
  }]);
  const droppedPlayer = roster?.find(p => p.name === dropName);

  // Enter name of player to add
  const { addName } = await inquirer.prompt([{
    type: 'input', name: 'addName',
    message: 'Who are you ADDING? (enter full MLB name)',
    validate: v => v.trim().length > 0 ? true : 'Enter a player name',
  }]);

  const { notes } = await inquirer.prompt([{
    type: 'input', name: 'notes',
    message: 'Notes (injury, reason, etc.) — optional:',
  }]);

  const effectiveNow = new Date().toISOString();

  // Confirm
  console.log(chalk.bold(`\n📋 Transaction summary:`));
  console.log(`  Team:   ${teamName}`);
  console.log(`  Drop:   ${dropName}  (HRs before ${new Date().toLocaleString()} count for ${teamName})`);
  console.log(`  Add:    ${addName.trim()}  (HRs from ${new Date().toLocaleString()} onward count for ${teamName})`);
  if (notes) console.log(`  Notes:  ${notes}`);
  console.log('');

  const { confirm } = await inquirer.prompt([{
    type: 'confirm', name: 'confirm',
    message: 'Confirm this transaction?', default: true,
  }]);
  if (!confirm) { console.log('Cancelled.'); process.exit(0); }

  // Resolve the add target BEFORE dropping. The added player almost always
  // already exists in the pool (team_id null) — players.name is UNIQUE, so we
  // REUSE that row instead of inserting a duplicate. Resolving first means a
  // failed add can't leave the roster with a dropped player and no replacement.
  const { data: existingRows } = await supabase
    .from('players')
    .select('id, name, team_id, dropped_at')
    .ilike('name', addName.trim())
    .limit(1);
  const existingAdd = existingRows?.[0];
  if (existingAdd && existingAdd.team_id !== null && existingAdd.dropped_at === null) {
    console.error(chalk.red(`Add error: ${existingAdd.name} is already on a roster.`));
    process.exit(1);
  }

  // 1. Mark dropped player
  const { error: dropErr } = await supabase
    .from('players')
    .update({ dropped_at: effectiveNow })
    .eq('id', droppedPlayer.id);
  if (dropErr) { console.error(chalk.red('Drop error:', dropErr.message)); process.exit(1); }

  // 2. Add the replacement — reuse the existing pool row (keeps its MLB ID so
  //    the watcher still matches it), or insert a new row if the name is new.
  let addedPlayer, addErr;
  if (existingAdd) {
    ({ data: addedPlayer, error: addErr } = await supabase
      .from('players')
      .update({ team_id: team.id, position: droppedPlayer.position, added_at: effectiveNow, dropped_at: null })
      .eq('id', existingAdd.id)
      .select()
      .single());
  } else {
    ({ data: addedPlayer, error: addErr } = await supabase
      .from('players')
      .insert({ name: addName.trim(), team_id: team.id, position: droppedPlayer.position, added_at: effectiveNow })
      .select()
      .single());
  }
  if (addErr) {
    // Roll the drop back so we don't leave an orphaned open slot.
    await supabase.from('players').update({ dropped_at: null }).eq('id', droppedPlayer.id);
    console.error(chalk.red('Add error:', addErr.message), chalk.gray('(drop rolled back)'));
    process.exit(1);
  }

  // 3. Record the transaction
  const { error: txErr } = await supabase
    .from('transactions')
    .insert({
      season,
      team_id:           team.id,
      dropped_player_id: droppedPlayer.id,
      added_player_id:   addedPlayer.id,
      effective_at:      effectiveNow,
      notes:             notes || null,
    });
  if (txErr) { console.error(chalk.red('Transaction record error:', txErr.message)); process.exit(1); }

  console.log(chalk.bold.green(`\n✅ Transaction complete!`));
  if (existingAdd) {
    console.log(chalk.gray(`  ${addName.trim()} was already in the pool — MLB ID carried over, no fetch-mlb-ids needed.`));
  } else {
    console.log(chalk.gray(`  ${addName.trim()} is a new name — run 'npm run fetch-mlb-ids -- --save' to match their MLB ID.`));
  }
  console.log(chalk.yellow(`\n⚠️  Remember: restart the watcher so it picks up the new player in its cache.`));
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
