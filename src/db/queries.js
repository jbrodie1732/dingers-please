const { supabase } = require('./client');

// Returns an array of hrId strings `${game_pk}:${at_bat_index}` for all HRs in DB.
// Used on watcher startup to repopulate the in-memory dedup Set.
async function getSeenHrIds() {
  const { data, error } = await supabase
    .from('home_runs')
    .select('game_pk, at_bat_index');
  if (error) {
    console.error('getSeenHrIds error:', error.message);
    return [];
  }
  return (data || []).map(r => `${r.game_pk}:${r.at_bat_index}`);
}

// Insert one HR row. Returns { data, error }.
// error.code === '23505' means unique constraint violation (already logged).
async function insertHomeRun(hrData) {
  return supabase
    .from('home_runs')
    .insert(hrData)
    .select()
    .single();
}

// Returns team standings from the view, sorted by total_hrs desc.
async function getTeamStandings() {
  const { data, error } = await supabase
    .from('team_standings')
    .select('team_id, team_name, total_hrs')
    .order('total_hrs', { ascending: false });
  if (error) {
    console.error('getTeamStandings error:', error.message);
    return [];
  }
  return data || [];
}

// Returns player standings from the view.
async function getPlayerStandings() {
  const { data, error } = await supabase
    .from('player_standings')
    .select('*')
    .order('total_hrs', { ascending: false });
  if (error) {
    console.error('getPlayerStandings error:', error.message);
    return [];
  }
  return data || [];
}

// Total HRs for one player (for alert message).
async function getPlayerHrCount(playerId) {
  const { count, error } = await supabase
    .from('home_runs')
    .select('*', { count: 'exact', head: true })
    .eq('player_id', playerId);
  if (error) return 0;
  return count || 0;
}

// All HRs for the past N days (for summary script).
async function getHomeRunsSince(daysBack) {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const sinceStr = since.toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('home_runs')
    .select('*, players(name, position, team_id, teams(name))')
    .gte('game_date', sinceStr)
    .order('hit_at', { ascending: true });
  if (error) {
    console.error('getHomeRunsSince error:', error.message);
    return [];
  }
  return data || [];
}

// All HRs ever (for full-season summary stats).
async function getAllHomeRuns() {
  const { data, error } = await supabase
    .from('home_runs')
    .select('*, players(name, position, team_id, teams(name))')
    .order('hit_at', { ascending: true });
  if (error) {
    console.error('getAllHomeRuns error:', error.message);
    return [];
  }
  return data || [];
}

// All players with their team info.
async function getAllPlayers() {
  const { data, error } = await supabase
    .from('players')
    .select('*, teams(name)')
    .not('team_id', 'is', null);
  if (error) {
    console.error('getAllPlayers error:', error.message);
    return [];
  }
  return data || [];
}

// All teams.
async function getAllTeams() {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('name');
  if (error) {
    console.error('getAllTeams error:', error.message);
    return [];
  }
  return data || [];
}

// Insert a team. Returns the created row or null.
async function upsertTeam(name) {
  const { data, error } = await supabase
    .from('teams')
    .upsert({ name }, { onConflict: 'name' })
    .select()
    .single();
  if (error) throw new Error(`upsertTeam failed: ${error.message}`);
  return data;
}

// Insert a player.
async function insertPlayer({ name, team_id, position, mlb_player_id }) {
  const { data, error } = await supabase
    .from('players')
    .insert({ name, team_id, position, mlb_player_id })
    .select()
    .single();
  if (error) throw new Error(`insertPlayer failed: ${error.message}`);
  return data;
}

// Insert a draft pick record.
async function insertDraftPick({ season, round, pick_in_round, overall_pick, player_id, team_id }) {
  const { data, error } = await supabase
    .from('draft_picks')
    .insert({ season, round, pick_in_round, overall_pick, player_id, team_id })
    .select()
    .single();
  if (error) throw new Error(`insertDraftPick failed: ${error.message}`);
  return data;
}

module.exports = {
  getSeenHrIds,
  insertHomeRun,
  getTeamStandings,
  getPlayerStandings,
  getPlayerHrCount,
  getHomeRunsSince,
  getAllHomeRuns,
  getAllPlayers,
  getAllTeams,
  upsertTeam,
  insertPlayer,
  insertDraftPick,
};
