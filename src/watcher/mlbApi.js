const axios = require('axios');

const BASE = 'https://statsapi.mlb.com';
const TIMEOUT = 5000;

const ACTIVE_STATES = new Set(['Live', 'Warmup', 'In Progress', 'Pre-Game']);

// Returns the current MLB schedule date string (YYYY-MM-DD), shifted 6h back
// so that midnight–5:59am games still count toward the previous day.
function getMlbDate() {
  const SHIFT_MS = 6 * 60 * 60 * 1000;
  const shifted = new Date(Date.now() - SHIFT_MS);
  return shifted.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

async function fetchSchedule(dateStr) {
  const url = `${BASE}/api/v1/schedule?sportId=1&date=${dateStr}`;
  const { data } = await axios.get(url, { timeout: TIMEOUT });
  return data.dates?.[0]?.games || [];
}

async function fetchLiveFeed(gamePk) {
  const url = `${BASE}/api/v1.1/game/${gamePk}/feed/live`;
  const { data } = await axios.get(url, { timeout: TIMEOUT });
  if (!data?.liveData?.plays) throw new Error('Incomplete liveData');
  return data.liveData.plays.allPlays || [];
}

function isActiveGame(game) {
  return ACTIVE_STATES.has(game.status?.abstractGameState);
}

// Extract Statcast hit data from a play object.
function getHitData(play) {
  if (!Array.isArray(play.playEvents)) return {};
  const ev = play.playEvents.find(e => e.hitData);
  if (!ev) return {};
  return {
    distance:    ev.hitData?.totalDistance    != null ? Number(ev.hitData.totalDistance)           : null,
    launchAngle: ev.hitData?.launchAngle      != null ? Number(ev.hitData.launchAngle)             : null,
    launchSpeed: ev.hitData?.launchSpeed      != null ? Number(ev.hitData.launchSpeed)             : null,
    sprayX:      ev.hitData?.coordinates?.coordX != null ? Number(ev.hitData.coordinates.coordX)  : null,
    sprayY:      ev.hitData?.coordinates?.coordY != null ? Number(ev.hitData.coordinates.coordY)  : null,
  };
}

module.exports = { getMlbDate, fetchSchedule, fetchLiveFeed, isActiveGame, getHitData };
