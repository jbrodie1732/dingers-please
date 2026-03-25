require('dotenv').config();

const path = require('path');
const { getMlbDate, fetchSchedule, fetchLiveFeed, isActiveGame, getHitData } = require('./mlbApi');
const { loadStadiaPaths, predictWouldDongForHR } = require('./mickeyMouse');
const { sendAlert, getDongLabel } = require('./alerts');
const { supabase } = require('../db/client');
const {
  getSeenHrIds,
  insertHomeRun,
  getTeamStandings,
  getPlayerHrCount,
} = require('../db/queries');

const POLL_INTERVAL_MS     = Number(process.env.POLL_INTERVAL_MS)     || 60000;
const EMPTY_POLL_THRESHOLD = Number(process.env.EMPTY_POLL_THRESHOLD) || 120;
const CSV_PATH = path.join(__dirname, '../../data/mlb_stadia_paths.csv');

let emptyPollCount = 0;
let seen           = new Set();   // hrIds processed this run
let playerCache    = new Map();   // player name → player row  (primary: draft name)
let playerIdCache  = new Map();   // mlb_player_id → player row (reliable; used first)
let stadiaByPark;                 // loaded once at startup

// ---- Rank calculator ----
function getTeamRank(standings, teamName) {
  const sorted = [...standings].sort((a, b) => b.total_hrs - a.total_hrs);
  let rank = 1;
  let prevTotal = null;
  let prevRank  = 1;
  for (let i = 0; i < sorted.length; i++) {
    const { team_name, total_hrs } = sorted[i];
    if (total_hrs !== prevTotal) prevRank = rank;
    if (team_name === teamName) {
      const tied = sorted.filter(t => t.total_hrs === total_hrs).length > 1;
      return tied ? `T-${prevRank}` : `${prevRank}`;
    }
    prevTotal = total_hrs;
    rank = i + 2;
  }
  return 'N/A';
}

// ---- Startup ----
async function init() {
  console.log('🚀 Dinger Watcher v2.0 starting...');

  stadiaByPark = loadStadiaPaths(CSV_PATH);
  console.log(`📍 Loaded ${stadiaByPark.size} stadiums`);

  // Hydrate seen Set from DB so restarts don't re-alert
  const existingIds = await getSeenHrIds();
  seen = new Set(existingIds);
  console.log(`📋 ${seen.size} existing HRs in DB`);

  // Load drafted players into memory caches
  const { data: players, error } = await supabase
    .from('players')
    .select('id, name, mlb_player_id, mlb_api_name, teams(name)')
    .not('team_id', 'is', null)
    .is('dropped_at', null);  // only active roster members

  if (error) {
    console.error('❌ Failed to load players from DB:', error.message);
    process.exit(1);
  }
  players.forEach(p => {
    playerCache.set(p.name, p);
    if (p.mlb_api_name)  playerCache.set(p.mlb_api_name, p);   // alternate name
    if (p.mlb_player_id) playerIdCache.set(p.mlb_player_id, p); // ID lookup (most reliable)
  });
  console.log(`👤 ${players.length} active players loaded (${playerIdCache.size} with MLB ID)`);
  console.log(`⏱  Polling every ${POLL_INTERVAL_MS / 1000}s. Let's get some dingers.\n`);

  pollGames();
  setInterval(pollGames, POLL_INTERVAL_MS);
}

// ---- Main poll loop ----
async function pollGames() {
  const date = getMlbDate();

  try {
    const allGames    = await fetchSchedule(date);
    const activeGames = allGames.filter(isActiveGame);

    console.log(`🔄 [${new Date().toLocaleTimeString()}] ${activeGames.length} active game(s) — ${date}`);

    if (activeGames.length === 0) {
      emptyPollCount++;
      if (emptyPollCount >= EMPTY_POLL_THRESHOLD) {
        console.log('🏁 No active games for a while. Watcher shutting down until tomorrow.');
        process.exit(0);
      }
      return;
    }
    emptyPollCount = 0;

    const processedThisPoll = new Set();

    for (const game of activeGames) {
      try {
        const plays = await fetchLiveFeed(game.gamePk);

        for (const play of plays) {
          if (play.result?.eventType !== 'home_run') continue;

          const atBatIndex = play.about?.atBatIndex ?? 'X';
          const batterId   = play.matchup?.batter?.id ?? play.matchup?.batter?.fullName ?? 'unknown';
          const hrId       = `${game.gamePk}:${atBatIndex}`;

          if (seen.has(hrId) || processedThisPoll.has(hrId)) continue;
          processedThisPoll.add(hrId);

          const playerName  = play.matchup?.batter?.fullName;
          const mlbBatterId = play.matchup?.batter?.id;

          // Match by MLB numeric ID first (reliable), fall back to name
          let player = (mlbBatterId && playerIdCache.get(mlbBatterId))
                    || playerCache.get(playerName);

          if (!player) continue; // not on any roster — skip silently

          // Warn if we matched by name but this player has no ID yet (post-draft reminder)
          if (!mlbBatterId || !playerIdCache.has(mlbBatterId)) {
            console.log(`⚠️  Name-matched ${playerName} (no MLB ID on file — run fetch-mlb-ids)`);
          }

          const hit = getHitData(play);

          // Mickey Meter
          let mickeyCount = null;
          let mickeyLabel = null;
          if (hit.sprayX != null && hit.sprayY != null && hit.distance != null && hit.launchSpeed != null && hit.launchAngle != null) {
            const dongInput = {
              distance: hit.distance,
              ev:       hit.launchSpeed,
              la:       hit.launchAngle,
              x:        hit.sprayX,
              y:        hit.sprayY,
            };
            const result = predictWouldDongForHR(dongInput, stadiaByPark);
            const parksCleared = result.perPark.filter(p => p.hr).length;
            mickeyCount = Math.max(parksCleared, hit.distance > 0 ? 1 : 0);
            mickeyLabel = getDongLabel(mickeyCount);
          }

          // Persist to Supabase (unique constraint prevents duplicate rows)
          const { data: hrRow, error: insertErr } = await insertHomeRun({
            player_id:          player.id,
            game_pk:            game.gamePk,
            at_bat_index:       Number(atBatIndex),
            batter_mlb_id:      typeof batterId === 'number' ? batterId : null,
            distance:           hit.distance,
            launch_angle:       hit.launchAngle,
            launch_speed:       hit.launchSpeed,
            spray_x:            hit.sprayX,
            spray_y:            hit.sprayY,
            mickey_meter_count: mickeyCount,
            mickey_meter_label: mickeyLabel,
            game_date:          date,
            hit_at:             new Date().toISOString(),
          });

          if (insertErr) {
            if (insertErr.code === '23505') {
              // Already in DB (e.g. from a previous process run that loaded before restart)
              seen.add(hrId);
            } else {
              console.error('❌ DB insert error:', insertErr.message);
            }
            continue;
          }

          seen.add(hrId);

          // Fetch standings + player total concurrently
          const [standings, playerTotal] = await Promise.all([
            getTeamStandings(),
            getPlayerHrCount(player.id),
          ]);

          const teamName  = player.teams?.name || 'Unknown';
          const teamEntry = standings.find(t => t.team_name === teamName);
          const rank      = getTeamRank(standings, teamName);

          sendAlert({
            playerName,
            playerTotal: playerTotal || 1,
            distance:    hit.distance,
            fantasyTeam: teamName,
            teamTotal:   teamEntry?.total_hrs || 1,
            rank,
          });

          console.log(`⚾  HR: ${playerName} (${teamName}) — ${hit.distance ?? 'N/A'} ft | Rank: ${rank}`);
        }
      } catch (gameErr) {
        console.warn(`⚠️  Game ${game.gamePk} error: ${gameErr.message}`);
      }
    }
  } catch (pollErr) {
    console.error('❌ Poll error:', pollErr.message);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => { console.log('SIGTERM received. Shutting down.'); process.exit(0); });
process.on('SIGINT',  () => { console.log('SIGINT received. Shutting down.');  process.exit(0); });

init().catch(err => {
  console.error('❌ Fatal startup error:', err);
  process.exit(1);
});
