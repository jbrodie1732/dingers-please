// send-summary.js — Daily morning recap via iMessage
// Run manually or let PM2 cron it at 8am:  node src/scripts/send-summary.js

require('dotenv').config();
const { sendSummary } = require('../watcher/alerts');
const { getAllHomeRuns, getTeamStandings, getPlayerStandings } = require('../db/queries');

const NUM_DAYS     = 5;
const HOT_HR_THRESH = 3;  // HRs in last N days to qualify as "hot"
const CARRY_PCT    = 0.30; // % of team HRs to be a "LeBron carrier"

// ---- Helpers ----

function formatDate(isoOrDate) {
  const d = new Date(isoOrDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateShort(iso) {
  const [yyyy, mm, dd] = (iso || '').split('-');
  if (!mm) return iso;
  return `${mm}/${dd}/${yyyy.slice(2)}`;
}

// Today's MLB date (same 6-hour shift as watcher)
function getMlbDate() {
  const shifted = new Date(Date.now() - 6 * 60 * 60 * 1000);
  return shifted.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function getTeamRankings(standings) {
  const sorted = [...standings].sort((a, b) => b.total_hrs - a.total_hrs);
  const ranks  = {};
  let rank = 1;
  let prevTotal = null;
  let prevRank  = 1;
  for (let i = 0; i < sorted.length; i++) {
    const { team_name, total_hrs } = sorted[i];
    if (total_hrs !== prevTotal) prevRank = rank;
    const tied = sorted.filter(t => t.total_hrs === total_hrs).length > 1;
    ranks[team_name] = tied ? `T-${prevRank}` : `${prevRank}`;
    prevTotal = total_hrs;
    rank = i + 2;
  }
  return ranks;
}

function formatStandings(standings) {
  const sorted = [...standings].sort((a, b) => b.total_hrs - a.total_hrs);
  const ranks  = getTeamRankings(standings);
  return sorted.map(t => `${ranks[t.team_name]}. ${t.team_name} (${t.total_hrs} HRs)`).join('\n');
}

function formatRankMovement(prev, curr) {
  const prevRanks = getTeamRankings(prev);
  const currRanks = getTeamRankings(curr);
  const rising  = [];
  const falling = [];
  for (const team of Object.keys(currRanks)) {
    const pRank = parseInt(prevRanks[team]) || 0;
    const cRank = parseInt(currRanks[team]) || 0;
    const delta = pRank - cRank;  // positive = moved up
    if (delta > 0) rising.push({ team, delta });
    if (delta < 0) falling.push({ team, delta });
  }
  rising.sort((a, b) => b.delta - a.delta);
  falling.sort((a, b) => a.delta - b.delta);
  const risingTxt  = rising.length  ? rising.map(e => `[+${e.delta}] ${e.team}`).join('\n')  : 'None';
  const fallingTxt = falling.length ? falling.map(e => `[${e.delta}] ${e.team}`).join('\n') : 'None';
  return { risingTxt, fallingTxt };
}

async function main() {
  const today     = getMlbDate();
  const yesterday = daysAgo(1);
  const nDaysAgo  = daysAgo(NUM_DAYS);

  console.log(`Building daily summary for ${today}...`);

  const [allHRs, standings, playerStandings] = await Promise.all([
    getAllHomeRuns(),
    getTeamStandings(),
    getPlayerStandings(),
  ]);

  if (allHRs.length === 0) {
    console.log('No HRs in database. Skipping summary.');
    process.exit(0);
  }

  // ---- Today's HRs ----
  const todayHRs = allHRs.filter(hr => hr.game_date === today);

  // ---- Yesterday's team totals (for rank movement) ----
  const hrsUpToYesterday = allHRs.filter(hr => hr.game_date < today);
  const prevTeamTotals   = {};
  for (const hr of hrsUpToYesterday) {
    const tName = hr.players?.teams?.name;
    if (tName) prevTeamTotals[tName] = (prevTeamTotals[tName] || 0) + 1;
  }
  const prevStandings = Object.entries(prevTeamTotals).map(([team_name, total_hrs]) => ({ team_name, total_hrs }));

  // ---- Longest HR today ----
  const validToday  = todayHRs.filter(hr => hr.distance != null);
  const longestToday = validToday.length ? validToday.reduce((m, h) => h.distance > m.distance ? h : m) : null;

  // ---- Longest HR season ----
  const validAll    = allHRs.filter(hr => hr.distance != null);
  const longestAll  = validAll.length ? validAll.reduce((m, h) => h.distance > m.distance ? h : m) : null;

  // ---- Hot players (N+ HRs in last NUM_DAYS days) ----
  const recentHRs = allHRs.filter(hr => hr.game_date >= nDaysAgo);
  const recentByPlayer = {};
  for (const hr of recentHRs) {
    const name = hr.players?.name;
    if (name) recentByPlayer[name] = (recentByPlayer[name] || 0) + 1;
  }
  const hotPlayers = Object.entries(recentByPlayer)
    .filter(([, count]) => count >= HOT_HR_THRESH)
    .sort((a, b) => b[1] - a[1]);

  // ---- Top avg distance players (min 2 HRs with distance) ----
  const topAvg = playerStandings
    .filter(p => p.distances && p.distances.length >= 2)
    .map(p => ({
      name: p.player_name,
      avg:  Math.round(p.distances.reduce((s, d) => s + d, 0) / p.distances.length),
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3);

  // ---- Heavy lifters (≥30% of team's HRs) ----
  const teamTotalsMap = Object.fromEntries(standings.map(t => [t.team_name, t.total_hrs]));
  const heavyLifters = playerStandings
    .filter(p => {
      const teamTotal = teamTotalsMap[p.team_name] || 0;
      return teamTotal > 0 && p.total_hrs / teamTotal >= CARRY_PCT;
    })
    .map(p => ({
      name: p.player_name,
      team: p.team_name,
      pct:  Math.round((p.total_hrs / teamTotalsMap[p.team_name]) * 100),
    }))
    .sort((a, b) => b.pct - a.pct);

  // ---- Rank movement ----
  const { risingTxt, fallingTxt } = formatRankMovement(prevStandings, standings);

  // ---- Assemble message ----
  const dayLongest    = longestToday ? `${longestToday.players?.name} – ${longestToday.distance} ft.` : 'N/A';
  const seasonLongest = longestAll   ? `${longestAll.players?.name} – ${longestAll.distance} ft. (${formatDate(longestAll.game_date)})` : 'N/A';
  const hotTxt        = hotPlayers.length ? hotPlayers.map(([n, c]) => `- ${n}: ${c} HRs`).join('\n') : 'None';
  const avgTxt        = topAvg.length ? topAvg.map(p => `- ${p.name}: ${p.avg} ft.`).join('\n') : 'N/A';
  const heavyTxt      = heavyLifters.length ? heavyLifters.map(h => `- ${h.name} (${h.team}): ${h.pct}%`).join('\n') : 'None';

  const message = `🗓️ Recap for ${formatDateShort(today)}

🏆 Dinger Standings 🏆

${formatStandings(standings)}

📈 Stock Rising 📈

${risingTxt}

📉 Stock Falling 📉

${fallingTxt}

======== #ANALytics ========

📏 Longest Gat – Today

${dayLongest}

📏 Longest Gat – Season

${seasonLongest}

📊 Top 3 Longest Avg. Gats

${avgTxt}

👨‍🍳 Let Them Cook 🔥
(${HOT_HR_THRESH}+ dingers in past ${NUM_DAYS} days)

${hotTxt}

💪 Carrying Harder than 2018 LeBron
(≥ ${Math.round(CARRY_PCT * 100)}% of team's total HRs)

${heavyTxt}`;

  console.log('\n📤 Summary:\n');
  console.log(message);
  sendSummary(message);
}

main().catch(err => {
  console.error('❌ Summary error:', err);
  process.exit(1);
});
