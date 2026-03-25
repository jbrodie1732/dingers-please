// mickeyMouse.js — "Would it Dong?" park clearance model
// Ported from the original with one key change: stadiaByPark is now
// loaded ONCE at watcher startup and passed in, instead of re-reading
// the CSV on every home run.

const fs = require('fs');

// ---- CSV parser (no external dep) ----
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) {
        cells.push(cur); cur = '';
      } else {
        cur += c;
      }
    }
    cells.push(cur);
    const obj = {};
    header.forEach((h, idx) => { obj[h] = cells[idx] !== undefined ? cells[idx] : ''; });
    return obj;
  });
}

// ---- Load CSV → Map<stadiumName, sample[]> ----
function loadStadiaPaths(csvPath) {
  const text = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(text);
  const byPark = new Map();
  for (const r of rows) {
    if (!r.stadium || !r.x || !r.y || !r.d_wall) continue;
    const stadium = String(r.stadium).trim();
    const rec = {
      x:                  Number(r.x),
      y:                  Number(r.y),
      d_wall:             Number(r.d_wall),
      fence_height:       Number(r.fence_height || 8),
      spray_angle_stadia: Number(r.spray_angle_stadia || angleDegFromXY(Number(r.x), Number(r.y))),
      team_abbr:          (r.team_abbr || '').trim(),
    };
    if (!byPark.has(stadium)) byPark.set(stadium, []);
    byPark.get(stadium).push(rec);
  }
  for (const list of byPark.values()) {
    list.sort((a, b) => a.spray_angle_stadia - b.spray_angle_stadia);
  }
  return byPark;
}

// ---- Geometry helpers ----
function angleDegFromXY(x, y) {
  return Math.atan2(x, y) * 180 / Math.PI;
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function wallAtAngle(parkSamples, angleDeg) {
  if (!parkSamples || parkSamples.length === 0) return { d_wall: 1000, fence_height: 8 };
  if (parkSamples.length === 1) return { d_wall: parkSamples[0].d_wall, fence_height: parkSamples[0].fence_height };
  let i2 = parkSamples.findIndex(p => p.spray_angle_stadia >= angleDeg);
  if (i2 <= 0) i2 = 1;
  if (i2 >= parkSamples.length) i2 = parkSamples.length - 1;
  const i1 = i2 - 1;
  const a1 = parkSamples[i1].spray_angle_stadia;
  const a2 = parkSamples[i2].spray_angle_stadia;
  const t  = (a2 === a1) ? 0 : clamp((angleDeg - a1) / (a2 - a1), 0, 1);
  return {
    d_wall:       parkSamples[i1].d_wall       * (1 - t) + parkSamples[i2].d_wall       * t,
    fence_height: parkSamples[i1].fence_height * (1 - t) + parkSamples[i2].fence_height * t,
  };
}

// ---- Clearance model ----
const COEF = {
  baseMarginFt:            6.5,
  laPenaltyPerDegBelow:    0.45,
  evPenaltyPerMPHBelow:    0.22,
  cornerPenaltyPerDeg:     0.12,
  heightFtToHorizFt:       1.6,
  noDoubterBonusFt:        4.0,
};

function requiredMargin(ev, la, sprayAngleAbsDeg) {
  let m = COEF.baseMarginFt;
  m += COEF.laPenaltyPerDegBelow  * clamp(27 - la, 0, 10);
  m += COEF.evPenaltyPerMPHBelow  * clamp(102 - ev, 0, 12);
  m += COEF.cornerPenaltyPerDeg   * clamp(sprayAngleAbsDeg - 25, 0, 12);
  return m;
}

function clearsInPark(hr, parkSamples) {
  const { distance, ev, la, x, y } = hr;
  if ([distance, ev, la, x, y].some(v => typeof v !== 'number' || isNaN(v))) return false;
  const x_c = x - 125;
  const y_c = 199 - y;
  const sprayAngle = angleDegFromXY(x_c, y_c);
  const { d_wall, fence_height } = wallAtAngle(parkSamples, sprayAngle);
  const heightTax = (fence_height || 8) * COEF.heightFtToHorizFt;
  const bonus     = (distance >= 430 || ev >= 110) ? COEF.noDoubterBonusFt : 0;
  const margin    = requiredMargin(ev, la, Math.abs(sprayAngle)) - bonus;
  return distance >= d_wall + heightTax + margin;
}

// ---- Public API ----

// Pass the pre-loaded stadiaByPark Map (from loadStadiaPaths).
// Returns { predicted_x30, perPark: [{ stadium, hr: bool }] }
function predictWouldDongForHR(hr, stadiaByPark) {
  let count = 0;
  const perPark = [];
  for (const [stadium, samples] of stadiaByPark.entries()) {
    const yes = clearsInPark(hr, samples);
    perPark.push({ stadium, hr: yes });
    if (yes) count++;
  }
  return { predicted_x30: clamp(count, 0, 30), perPark };
}

// Convenience wrapper that also loads the CSV (used in one-off scripts).
function predictWouldDong(hr, csvPath) {
  return predictWouldDongForHR(hr, loadStadiaPaths(csvPath));
}

module.exports = {
  loadStadiaPaths,
  predictWouldDongForHR,
  predictWouldDong,
};
