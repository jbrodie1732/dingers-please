// backtest-watcher.js — Dry-run the live watcher's detection/matching/scoring
// logic against a REAL MLB game (completed or in-progress), without touching
// the database or sending any iMessage alerts.
//
// Why this exists: pre-draft, almost no player has a team_id set, so the
// real watcher's roster cache is nearly empty and won't match anything. This
// script reuses the exact same modules the real watcher uses (mlbApi,
// mickeyMouse, alerts' message builder) but matches against the WHOLE
// player pool instead of just drafted players — so it can validate HR
// detection, hitData extraction, MLB ID/name matching against
// dingers_player_data.xlsx, and the Mickey Meter, all before the draft
// finishes. Run it again after the draft to also sanity-check team
// attribution.
//
// This is READ-ONLY: it only SELECTs from players/teams and calls the
// public MLB Stats API. It never inserts into home_runs and never calls
// sendAlert/sendSummary — nothing here can spam the group chat or touch
// the live dashboard.
//
// Usage:
//   node src/scripts/backtest-watcher.js --date=2026-07-06
//   node src/scripts/backtest-watcher.js --date=2026-07-06 --gamePk=824089
//
// If a date comes back with 0 games or everything still "Preview"/
// "Scheduled", that specific date hasn't been played yet as far as the live
// API is concerned — just try an earlier one (it'll tell you the status of
// every game it finds so you can see why nothing turned up).

require('dotenv').config();
const path = require('path');
const { fetchSchedule, fetchLiveFeed, getHitData } = require('../watcher/mlbApi');
const { loadStadiaPaths, predictWouldDongForHR } = require('../watcher/mickeyMouse');
const { getDongLabel, buildAlertMessage } = require('../watcher/alerts');
const { supabase } = require('../db/client');

const CSV_PATH = path.join(__dirname, '../../data/mlb_stadia_paths.csv');

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

async function main() {
  const { date, gamePk: onlyGamePk } = parseArgs();
  if (!date) {
    console.error('Usage: node src/scripts/backtest-watcher.js --date=YYYY-MM-DD [--gamePk=12345]');
    process.exit(1);
  }

  console.log(`\n🧪 BACKTEST — dry run against ${date}${onlyGamePk ? ` (game ${onlyGamePk})` : ''}`);
  console.log('   (read-only: no DB writes, no iMessages sent)\n');

  // ---- Load stadium fence data (same CSV/logic as production) ----
  const stadiaByPark = loadStadiaPaths(CSV_PATH);

  // ---- Load the FULL player pool, not just drafted players ----
  const { data: players, error } = await supabase
    .from('players')
    .select('id, name, mlb_player_id, mlb_api_name, team_id, teams(name)');
  if (error) {
    console.error('❌ Failed to load players:', error.message);
    process.exit(1);
  }
  const playerCache = new Map();
  const playerIdCache = new Map();
  players.forEach(p => {
    playerCache.set(p.name, p);
    if (p.mlb_api_name) playerCache.set(p.mlb_api_name, p);
    if (p.mlb_player_id) playerIdCache.set(p.mlb_player_id, p);
  });
  const draftedCount = players.filter(p => p.team_id).length;
  console.log(`👤 Pool loaded: ${players.length} players (${playerIdCache.size} with an MLB ID on file, ${draftedCount} currently drafted)\n`);

  // ---- Fetch the schedule for this date ----
  const allGames = await fetchSchedule(date);
  if (allGames.length === 0) {
    console.log(`No games found on the MLB schedule for ${date} at all. Try a different date.`);
    return;
  }
  const games = onlyGamePk ? allGames.filter(g => String(g.gamePk) === String(onlyGamePk)) : allGames;
  if (games.length === 0) {
    console.log(`Game ${onlyGamePk} wasn't found on the ${date} schedule.`);
    return;
  }

  console.log(`📅 ${games.length} game(s) on ${date}:`);
  games.forEach(g => {
    const away = g.teams?.away?.team?.name, home = g.teams?.home?.team?.name;
    console.log(`   ${g.gamePk}  ${away} @ ${home}  — ${g.status?.detailedState} (${g.status?.abstractGameState})`);
  });
  console.log('');

  const playedGames = games.filter(g => g.status?.abstractGameState !== 'Preview');
  if (playedGames.length === 0) {
    console.log(`⚠️  Every game on ${date} is still "Preview" (not started) as far as the live API is concerned.`);
    console.log(`    That means there's nothing to detect yet for this date — try an earlier one.\n`);
    return;
  }

  let totalHRs = 0, matchedById = 0, matchedByName = 0, unmatched = 0, missingHitData = 0;

  for (const game of playedGames) {
    let plays;
    try {
      plays = await fetchLiveFeed(game.gamePk);
    } catch (e) {
      console.warn(`⚠️  Couldn't fetch feed for game ${game.gamePk}: ${e.message}`);
      continue;
    }

    const homeRunPlays = plays.filter(p => p.result?.eventType === 'home_run');
    if (homeRunPlays.length === 0) continue;

    const away = game.teams?.away?.team?.name, home = game.teams?.home?.team?.name;
    console.log(`\n=== ${away} @ ${home}  (game ${game.gamePk}) — ${homeRunPlays.length} HR(s) ===`);

    for (const play of homeRunPlays) {
      totalHRs++;
      const atBatIndex = play.about?.atBatIndex ?? 'X';
      const playerName = play.matchup?.batter?.fullName;
      const mlbBatterId = play.matchup?.batter?.id;

      const idHit = mlbBatterId && playerIdCache.has(mlbBatterId);
      const player = (idHit && playerIdCache.get(mlbBatterId)) || playerCache.get(playerName);
      const matchType = idHit ? 'id' : player ? 'name' : 'none';
      if (matchType === 'id') matchedById++;
      else if (matchType === 'name') matchedByName++;
      else unmatched++;

      const hit = getHitData(play);
      const hasFullHitData = hit.distance != null && hit.launchSpeed != null && hit.launchAngle != null && hit.sprayX != null && hit.sprayY != null;
      if (!hasFullHitData) missingHitData++;

      let mickeyCount = null, mickeyLabel = null;
      if (hasFullHitData) {
        const result = predictWouldDongForHR(
          { distance: hit.distance, ev: hit.launchSpeed, la: hit.launchAngle, x: hit.sprayX, y: hit.sprayY },
          stadiaByPark
        );
        const parksCleared = result.perPark.filter(p => p.hr).length;
        mickeyCount = Math.max(parksCleared, hit.distance > 0 ? 1 : 0);
        mickeyLabel = getDongLabel(mickeyCount);
      }

      const teamName = player?.teams?.name;
      console.log(`\n⚾  ${playerName}${mlbBatterId ? ` (MLB ID ${mlbBatterId})` : ''} — at-bat #${atBatIndex}`);
      console.log(`    hrId (dedup key): ${game.gamePk}:${atBatIndex}`);
      console.log(`    Match: ${
        matchType === 'id'   ? '✅ matched by MLB ID' :
        matchType === 'name' ? '⚠️  matched by name only (no MLB ID on file for this player yet)' :
                                '❌ not in your player pool'
      }${player ? ` → ${player.name}${teamName ? ` (${teamName})` : ' (undrafted)'}` : ''}`);
      console.log(`    Distance: ${hit.distance ?? 'N/A'} ft | EV: ${hit.launchSpeed ?? 'N/A'} mph | LA: ${hit.launchAngle ?? 'N/A'}° | Spray: (${hit.sprayX ?? 'N/A'}, ${hit.sprayY ?? 'N/A'})`);
      if (!hasFullHitData) console.log(`    ⚠️  Incomplete Statcast data on this play — real games do sometimes miss a field, not necessarily a bug`);
      if (mickeyCount != null) console.log(`    Mickey Meter: ${mickeyCount}/30 — ${mickeyLabel}`);

      if (player && teamName) {
        const preview = buildAlertMessage({
          playerName, playerTotal: '?', distance: hit.distance, fantasyTeam: teamName,
          teamTotal: '?', rank: '?', mickeyCount, mickeyLabel,
        });
        console.log(`    --- alert preview ("?" fields use live standings at insert time) ---`);
        console.log('    ' + preview.split('\n').join('\n    '));
      }
    }
  }

  console.log(`\n\n📊 SUMMARY — ${date}`);
  console.log(`   ${totalHRs} total home runs across ${playedGames.length} played game(s)`);
  console.log(`   ${matchedById} matched by MLB ID, ${matchedByName} matched by name only, ${unmatched} not in your pool`);
  console.log(`   (unmatched is expected — most MLB batters on any given day aren't in your ~250-player draft pool)`);
  console.log(`   ${missingHitData} had incomplete Statcast data (distance/EV/LA/coords)`);
  console.log(`\nNothing was written to the database and no iMessages were sent.\n`);
}

main().catch(err => {
  console.error('❌ Backtest error:', err);
  process.exit(1);
});
