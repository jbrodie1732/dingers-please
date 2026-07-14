// ─── Mock data: 15 teams, 9 positions, real 2026 sluggers ──────────────────────
// Used everywhere. Realistic enough to look real in a screenshot.

const POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

// 15 distinct, ordered team accent colors (assigned by seed/standings rank)
const TEAM_COLORS = [
  '#F5C518', // gold - 1
  '#4ECDC4', // teal
  '#FF6B6B', // coral
  '#A8E6CF', // mint
  '#FF8B94', // pink
  '#9B59B6', // purple
  '#3498DB', // blue
  '#E67E22', // orange
  '#2ECC71', // green
  '#E74C3C', // crimson
  '#F39C12', // amber
  '#1ABC9C', // turquoise
  '#D7BDE2', // lilac
  '#85C1E9', // sky
  '#F8B739', // mustard
];

const TEAMS = [
  { id: 't1',  name: 'Bronx Bombers Jr', owner: 'Jake',     hrs: 47 },
  { id: 't2',  name: 'Sho-Time',          owner: 'Marcus',  hrs: 44 },
  { id: 't3',  name: 'Mickey Mouse Park', owner: 'Dre',     hrs: 39 },
  { id: 't4',  name: 'Splash Hits',       owner: 'Pete',    hrs: 38 },
  { id: 't5',  name: 'Goin Yard',         owner: 'Sam',     hrs: 35 },
  { id: 't6',  name: 'Launch Angle Lab',  owner: 'Henry',   hrs: 33 },
  { id: 't7',  name: 'Foul Pole Posse',   owner: 'Will',    hrs: 31 },
  { id: 't8',  name: 'Warning Track Power', owner: 'Tony',  hrs: 29 },
  { id: 't9',  name: 'Bat Flippers',      owner: 'Kevin',   hrs: 27 },
  { id: 't10', name: 'The Wheelhouse',    owner: 'Danny',   hrs: 25 },
  { id: 't11', name: 'Big Flies Inc',     owner: 'Greg',    hrs: 23 },
  { id: 't12', name: 'Sun Belt Sluggers', owner: 'Nick',    hrs: 21 },
  { id: 't13', name: 'Statcast Saints',   owner: 'Owen',    hrs: 19 },
  { id: 't14', name: 'Two Strike Hackers', owner: 'Reed',   hrs: 17 },
  { id: 't15', name: 'Mendoza & Sons',    owner: 'Charlie', hrs: 12 },
];

// Real 2026 sluggers, position-mapped roughly to 2025 actual positions.
// 9 positions × 15 teams = 135 picks total.
const _PLAYERS_RAW = [
  // C
  { name: 'Cal Raleigh',       pos: 'C',  mlb: 'SEA', tier: 1 },
  { name: 'Will Smith',         pos: 'C',  mlb: 'LAD', tier: 1 },
  { name: 'Adley Rutschman',    pos: 'C',  mlb: 'BAL', tier: 2 },
  { name: 'Salvador Perez',     pos: 'C',  mlb: 'KC',  tier: 2 },
  { name: 'William Contreras',  pos: 'C',  mlb: 'MIL', tier: 2 },
  { name: 'Yainer Diaz',        pos: 'C',  mlb: 'HOU', tier: 3 },
  { name: 'Shea Langeliers',    pos: 'C',  mlb: 'ATH', tier: 3 },
  { name: 'Logan O\u2019Hoppe', pos: 'C',  mlb: 'LAA', tier: 3 },
  { name: 'Tyler Stephenson',   pos: 'C',  mlb: 'CIN', tier: 3 },
  { name: 'Bo Naylor',          pos: 'C',  mlb: 'CLE', tier: 4 },
  { name: 'Sean Murphy',        pos: 'C',  mlb: 'ATL', tier: 4 },
  { name: 'J.T. Realmuto',      pos: 'C',  mlb: 'PHI', tier: 4 },
  { name: 'Patrick Bailey',     pos: 'C',  mlb: 'SF',  tier: 4 },
  { name: 'Ivan Herrera',       pos: 'C',  mlb: 'STL', tier: 5 },
  { name: 'Carson Kelly',       pos: 'C',  mlb: 'CHC', tier: 5 },

  // 1B
  { name: 'Pete Alonso',        pos: '1B', mlb: 'NYM', tier: 1 },
  { name: 'Vladimir Guerrero Jr.', pos: '1B', mlb: 'TOR', tier: 1 },
  { name: 'Bryce Harper',       pos: '1B', mlb: 'PHI', tier: 1 },
  { name: 'Freddie Freeman',    pos: '1B', mlb: 'LAD', tier: 2 },
  { name: 'Matt Olson',         pos: '1B', mlb: 'ATL', tier: 2 },
  { name: 'Christian Walker',   pos: '1B', mlb: 'HOU', tier: 2 },
  { name: 'Josh Naylor',        pos: '1B', mlb: 'ARI', tier: 3 },
  { name: 'Pavin Smith',        pos: '1B', mlb: 'ARI', tier: 3 },
  { name: 'Spencer Torkelson',  pos: '1B', mlb: 'DET', tier: 3 },
  { name: 'Andrew Vaughn',      pos: '1B', mlb: 'CWS', tier: 4 },
  { name: 'Triston Casas',      pos: '1B', mlb: 'BOS', tier: 4 },
  { name: 'Ryan Mountcastle',   pos: '1B', mlb: 'BAL', tier: 4 },
  { name: 'Nathaniel Lowe',     pos: '1B', mlb: 'WSH', tier: 4 },
  { name: 'Carlos Santana',     pos: '1B', mlb: 'CLE', tier: 5 },
  { name: 'Joey Bart',          pos: '1B', mlb: 'PIT', tier: 5 },

  // 2B
  { name: 'Ketel Marte',        pos: '2B', mlb: 'ARI', tier: 1 },
  { name: 'Jose Altuve',        pos: '2B', mlb: 'HOU', tier: 1 },
  { name: 'Jackson Holliday',   pos: '2B', mlb: 'BAL', tier: 2 },
  { name: 'Marcus Semien',      pos: '2B', mlb: 'TEX', tier: 2 },
  { name: 'Brice Turang',       pos: '2B', mlb: 'MIL', tier: 2 },
  { name: 'Andres Gimenez',     pos: '2B', mlb: 'TOR', tier: 3 },
  { name: 'Luis Garcia Jr.',    pos: '2B', mlb: 'WSH', tier: 3 },
  { name: 'Brandon Lowe',       pos: '2B', mlb: 'TB',  tier: 3 },
  { name: 'Jonathan India',     pos: '2B', mlb: 'KC',  tier: 4 },
  { name: 'Gleyber Torres',     pos: '2B', mlb: 'DET', tier: 4 },
  { name: 'Ozzie Albies',       pos: '2B', mlb: 'ATL', tier: 4 },
  { name: 'Nico Hoerner',       pos: '2B', mlb: 'CHC', tier: 4 },
  { name: 'Jorge Polanco',      pos: '2B', mlb: 'SEA', tier: 5 },
  { name: 'Tommy Edman',        pos: '2B', mlb: 'LAD', tier: 5 },
  { name: 'Luis Rengifo',       pos: '2B', mlb: 'LAA', tier: 5 },

  // 3B
  { name: 'Jose Ramirez',       pos: '3B', mlb: 'CLE', tier: 1 },
  { name: 'Rafael Devers',      pos: '3B', mlb: 'SF',  tier: 1 },
  { name: 'Manny Machado',      pos: '3B', mlb: 'SD',  tier: 1 },
  { name: 'Austin Riley',       pos: '3B', mlb: 'ATL', tier: 2 },
  { name: 'Junior Caminero',    pos: '3B', mlb: 'TB',  tier: 2 },
  { name: 'Eugenio Suarez',     pos: '3B', mlb: 'SEA', tier: 2 },
  { name: 'Mark Vientos',       pos: '3B', mlb: 'NYM', tier: 3 },
  { name: 'Isaac Paredes',      pos: '3B', mlb: 'HOU', tier: 3 },
  { name: 'Alex Bregman',       pos: '3B', mlb: 'BOS', tier: 3 },
  { name: 'Royce Lewis',        pos: '3B', mlb: 'MIN', tier: 3 },
  { name: 'Matt Chapman',       pos: '3B', mlb: 'SF',  tier: 4 },
  { name: 'Max Muncy',          pos: '3B', mlb: 'LAD', tier: 4 },
  { name: 'Nolan Arenado',      pos: '3B', mlb: 'STL', tier: 4 },
  { name: 'Yoan Moncada',       pos: '3B', mlb: 'LAA', tier: 5 },
  { name: 'Jordan Westburg',    pos: '3B', mlb: 'BAL', tier: 5 },

  // SS
  { name: 'Bobby Witt Jr.',     pos: 'SS', mlb: 'KC',  tier: 1 },
  { name: 'Gunnar Henderson',   pos: 'SS', mlb: 'BAL', tier: 1 },
  { name: 'Elly De La Cruz',    pos: 'SS', mlb: 'CIN', tier: 1 },
  { name: 'Francisco Lindor',   pos: 'SS', mlb: 'NYM', tier: 2 },
  { name: 'Trea Turner',        pos: 'SS', mlb: 'PHI', tier: 2 },
  { name: 'Corey Seager',       pos: 'SS', mlb: 'TEX', tier: 2 },
  { name: 'CJ Abrams',          pos: 'SS', mlb: 'WSH', tier: 3 },
  { name: 'Anthony Volpe',      pos: 'SS', mlb: 'NYY', tier: 3 },
  { name: 'Oneil Cruz',         pos: 'SS', mlb: 'PIT', tier: 3 },
  { name: 'Dansby Swanson',     pos: 'SS', mlb: 'CHC', tier: 4 },
  { name: 'Xander Bogaerts',    pos: 'SS', mlb: 'SD',  tier: 4 },
  { name: 'Willy Adames',       pos: 'SS', mlb: 'SF',  tier: 4 },
  { name: 'Carlos Correa',      pos: 'SS', mlb: 'MIN', tier: 4 },
  { name: 'Bo Bichette',        pos: 'SS', mlb: 'TOR', tier: 5 },
  { name: 'Geraldo Perdomo',    pos: 'SS', mlb: 'ARI', tier: 5 },

  // LF
  { name: 'Kyle Schwarber',     pos: 'LF', mlb: 'PHI', tier: 1 },
  { name: 'Yordan Alvarez',     pos: 'LF', mlb: 'HOU', tier: 1 },
  { name: 'Jose Ramirez',       pos: 'LF', mlb: 'NYM', tier: 1 },
  { name: 'Riley Greene',       pos: 'LF', mlb: 'DET', tier: 2 },
  { name: 'Christopher Morel',  pos: 'LF', mlb: 'TB',  tier: 2 },
  { name: 'Jarren Duran',       pos: 'LF', mlb: 'BOS', tier: 2 },
  { name: 'Ian Happ',           pos: 'LF', mlb: 'CHC', tier: 3 },
  { name: 'Lourdes Gurriel Jr.', pos: 'LF', mlb: 'ARI', tier: 3 },
  { name: 'Brandon Marsh',      pos: 'LF', mlb: 'PHI', tier: 3 },
  { name: 'Steven Kwan',        pos: 'LF', mlb: 'CLE', tier: 4 },
  { name: 'Tommy Pham',         pos: 'LF', mlb: 'PIT', tier: 4 },
  { name: 'Taylor Ward',        pos: 'LF', mlb: 'LAA', tier: 4 },
  { name: 'Andrew Benintendi',  pos: 'LF', mlb: 'CWS', tier: 4 },
  { name: 'Austin Hays',        pos: 'LF', mlb: 'CIN', tier: 5 },
  { name: 'James Wood',         pos: 'LF', mlb: 'WSH', tier: 5 },

  // CF
  { name: 'Aaron Judge',        pos: 'CF', mlb: 'NYY', tier: 1 },
  { name: 'Julio Rodriguez',    pos: 'CF', mlb: 'SEA', tier: 1 },
  { name: 'Pete Crow-Armstrong',pos: 'CF', mlb: 'CHC', tier: 1 },
  { name: 'Jackson Chourio',    pos: 'CF', mlb: 'MIL', tier: 2 },
  { name: 'Jackson Merrill',    pos: 'CF', mlb: 'SD',  tier: 2 },
  { name: 'Byron Buxton',       pos: 'CF', mlb: 'MIN', tier: 2 },
  { name: 'Cedric Mullins',     pos: 'CF', mlb: 'BAL', tier: 3 },
  { name: 'Brenton Doyle',      pos: 'CF', mlb: 'COL', tier: 3 },
  { name: 'Michael Harris II',  pos: 'CF', mlb: 'ATL', tier: 3 },
  { name: 'Kyle Tucker',        pos: 'CF', mlb: 'CHC', tier: 3 },
  { name: 'Cody Bellinger',     pos: 'CF', mlb: 'NYY', tier: 4 },
  { name: 'Lane Thomas',        pos: 'CF', mlb: 'CLE', tier: 4 },
  { name: 'Daulton Varsho',     pos: 'CF', mlb: 'TOR', tier: 4 },
  { name: 'Jose Siri',          pos: 'CF', mlb: 'NYM', tier: 5 },
  { name: 'Jake Meyers',        pos: 'CF', mlb: 'HOU', tier: 5 },

  // RF
  { name: 'Juan Soto',          pos: 'RF', mlb: 'NYM', tier: 1 },
  { name: 'Ronald Acuna Jr.',   pos: 'RF', mlb: 'ATL', tier: 1 },
  { name: 'Fernando Tatis Jr.', pos: 'RF', mlb: 'SD',  tier: 1 },
  { name: 'Mookie Betts',       pos: 'RF', mlb: 'LAD', tier: 2 },
  { name: 'Teoscar Hernandez',  pos: 'RF', mlb: 'LAD', tier: 2 },
  { name: 'Wyatt Langford',     pos: 'RF', mlb: 'TEX', tier: 2 },
  { name: 'Anthony Santander',  pos: 'RF', mlb: 'TOR', tier: 3 },
  { name: 'Lawrence Butler',    pos: 'RF', mlb: 'ATH', tier: 3 },
  { name: 'Heliot Ramos',       pos: 'RF', mlb: 'SF',  tier: 3 },
  { name: 'Jasson Dominguez',   pos: 'RF', mlb: 'NYY', tier: 4 },
  { name: 'Nolan Jones',        pos: 'RF', mlb: 'COL', tier: 4 },
  { name: 'Wilyer Abreu',       pos: 'RF', mlb: 'BOS', tier: 4 },
  { name: 'Adolis Garcia',      pos: 'RF', mlb: 'TEX', tier: 4 },
  { name: 'Tyler O\u2019Neill', pos: 'RF', mlb: 'BAL', tier: 5 },
  { name: 'Mike Trout',         pos: 'RF', mlb: 'LAA', tier: 5 },

  // DH
  { name: 'Shohei Ohtani',      pos: 'DH', mlb: 'LAD', tier: 1 },
  { name: 'Marcell Ozuna',      pos: 'DH', mlb: 'ATL', tier: 1 },
  { name: 'Giancarlo Stanton',  pos: 'DH', mlb: 'NYY', tier: 2 },
  { name: 'J.D. Martinez',      pos: 'DH', mlb: 'NYM', tier: 2 },
  { name: 'Anthony Rizzo',      pos: 'DH', mlb: 'BOS', tier: 2 },
  { name: 'Joc Pederson',       pos: 'DH', mlb: 'TEX', tier: 3 },
  { name: 'Justin Turner',      pos: 'DH', mlb: 'CHC', tier: 3 },
  { name: 'Ben Rice',           pos: 'DH', mlb: 'NYY', tier: 3 },
  { name: 'Brent Rooker',       pos: 'DH', mlb: 'ATH', tier: 3 },
  { name: 'Nelson Cruz',        pos: 'DH', mlb: 'KC',  tier: 4 },
  { name: 'Yandy Diaz',         pos: 'DH', mlb: 'TB',  tier: 4 },
  { name: 'Mitch Garver',       pos: 'DH', mlb: 'SEA', tier: 4 },
  { name: 'Jorge Soler',        pos: 'DH', mlb: 'LAA', tier: 4 },
  { name: 'Yuli Gurriel',       pos: 'DH', mlb: 'KC',  tier: 5 },
  { name: 'Kerry Carpenter',    pos: 'DH', mlb: 'DET', tier: 5 },
];

// Stamp ids
const PLAYERS = _PLAYERS_RAW.map((p, i) => ({ id: 'p' + i, ...p, hrs: 0, drafted: false, fantasy_team: null }));

// ─── Snake-draft assignment ───────────────────────────────────────────────────
// Round 1 = team 1..15, Round 2 = team 15..1, etc. 9 rounds, all 9 positions.
// Tier-1 sluggers go early; teams pick by current need.
function buildDraft() {
  const rounds = 9;
  const order = [];
  for (let r = 1; r <= rounds; r++) {
    const snake = r % 2 === 0;
    for (let p = 0; p < TEAMS.length; p++) {
      const teamIdx = snake ? TEAMS.length - 1 - p : p;
      order.push({ round: r, teamIdx, pickInRound: p + 1 });
    }
  }

  const teamRosters = TEAMS.map(() => ({}));
  const pool = [...PLAYERS].sort((a, b) => a.tier - b.tier);
  const picks = [];
  let overall = 0;

  for (const slot of order) {
    overall++;
    const team = TEAMS[slot.teamIdx];
    const roster = teamRosters[slot.teamIdx];
    // Find best player at a position the team still needs
    const candidate = pool.find(p => !p.drafted && !roster[p.pos]);
    if (!candidate) continue;
    candidate.drafted = true;
    candidate.fantasy_team = team.name;
    roster[candidate.pos] = candidate;
    picks.push({
      overall,
      round: slot.round,
      pickInRound: slot.pickInRound,
      teamId: team.id,
      teamName: team.name,
      teamIdx: slot.teamIdx,
      player: candidate,
    });
  }
  return { picks, teamRosters };
}

const _draft = buildDraft();
const DRAFT_PICKS = _draft.picks;
const TEAM_ROSTERS = _draft.teamRosters; // [teamIdx] => { pos: player }

// Distribute current HR totals across each team's roster
TEAMS.forEach((team, idx) => {
  const roster = TEAM_ROSTERS[idx];
  const players = Object.values(roster);
  let remaining = team.hrs;
  // Weighted: tier-1 gets more, tier-5 gets less
  const weights = players.map(p => 6 - p.tier);
  const wsum = weights.reduce((a, b) => a + b, 0);
  players.forEach((p, i) => {
    const target = Math.round((weights[i] / wsum) * team.hrs);
    p.hrs = Math.max(0, target);
    remaining -= p.hrs;
  });
  // Adjust top to make exact
  if (remaining !== 0 && players.length) {
    const top = [...players].sort((a, b) => b.hrs - a.hrs)[0];
    top.hrs += remaining;
  }
});

// ─── Recent home runs feed (15 events, mix of distances/Mickey labels) ────────
const HR_FLAVOR = [
  { dist: 472, exitVelo: 116.4, launch: 28, mickey: 30, label: 'LEGIT', spray: { x: 0.62, y: 0.18 } },
  { dist: 415, exitVelo: 105.1, launch: 31, mickey: 22, label: 'LEGIT', spray: { x: 0.50, y: 0.30 } },
  { dist: 384, exitVelo: 99.2,  launch: 32, mickey: 12, label: 'MICKEY MOUSE', spray: { x: 0.30, y: 0.55 } },
  { dist: 421, exitVelo: 107.3, launch: 26, mickey: 26, label: 'LEGIT', spray: { x: 0.71, y: 0.40 } },
  { dist: 358, exitVelo: 96.4,  launch: 35, mickey: 6,  label: 'MICKEY MOUSE', spray: { x: 0.20, y: 0.62 } },
  { dist: 449, exitVelo: 112.0, launch: 27, mickey: 30, label: 'LEGIT', spray: { x: 0.55, y: 0.10 } },
  { dist: 397, exitVelo: 102.5, launch: 30, mickey: 18, label: 'LEGIT', spray: { x: 0.40, y: 0.42 } },
  { dist: 436, exitVelo: 109.8, launch: 25, mickey: 28, label: 'LEGIT', spray: { x: 0.68, y: 0.25 } },
  { dist: 372, exitVelo: 97.9,  launch: 33, mickey: 9,  label: 'MICKEY MOUSE', spray: { x: 0.35, y: 0.58 } },
  { dist: 408, exitVelo: 104.6, launch: 29, mickey: 21, label: 'LEGIT', spray: { x: 0.48, y: 0.36 } },
  { dist: 462, exitVelo: 114.2, launch: 26, mickey: 30, label: 'LEGIT', spray: { x: 0.74, y: 0.15 } },
  { dist: 391, exitVelo: 100.7, launch: 31, mickey: 15, label: 'MICKEY MOUSE', spray: { x: 0.25, y: 0.50 } },
  { dist: 419, exitVelo: 106.8, launch: 28, mickey: 24, label: 'LEGIT', spray: { x: 0.60, y: 0.28 } },
  { dist: 403, exitVelo: 103.4, launch: 30, mickey: 20, label: 'LEGIT', spray: { x: 0.45, y: 0.38 } },
  { dist: 388, exitVelo: 99.8,  launch: 32, mickey: 14, label: 'MICKEY MOUSE', spray: { x: 0.32, y: 0.52 } },
];

// Build feed: rotate through top sluggers, attach realistic "minutes ago"
const HOME_RUNS = HR_FLAVOR.map((f, i) => {
  // Pick a slugger (cycle through tier-1 and tier-2 across teams)
  const sluggers = PLAYERS.filter(p => p.tier <= 2 && p.fantasy_team);
  const player = sluggers[i % sluggers.length];
  const team = TEAMS.find(t => t.name === player.fantasy_team);
  const minutesAgo = i === 0 ? 2 : i === 1 ? 11 : i === 2 ? 28 : 45 + i * 30;
  return {
    id: 'hr' + i,
    player,
    team,
    teamColor: TEAM_COLORS[TEAMS.indexOf(team) % TEAM_COLORS.length],
    distance: f.dist,
    exitVelo: f.exitVelo,
    launchAngle: f.launch,
    mickeyMeter: f.mickey,
    mickeyLabel: f.label,
    spray: f.spray,
    minutesAgo,
    inning: ['T1','B2','T3','B4','T5','B5','T6','B7','T8','B8','T9'][i % 11],
  };
});

// ─── Hourly HR event log (for smooth time-synced playback) ────────────────────
// Build a sequence of {t (hours since ASB), teamIdx, playerName} for each HR
// in each team's final total. Distributes them with realistic variance.
const ASB_START = new Date('2026-07-15T00:00:00Z'); // ASB ends, post-ASB begins
const HOURS_TOTAL = 45 * 24; // 45 days * 24 hours = 1080 hours

function buildHourlyEvents() {
  const events = [];
  TEAMS.forEach((team, teamIdx) => {
    const final = team.hrs;
    // Pseudo-random but deterministic: distribute HRs across the 1080-hour window
    // with a slight bias toward evening hours and game days
    const seed = teamIdx * 1009 + 7;
    let s = seed;
    const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };

    for (let i = 0; i < final; i++) {
      // Pick a day (more uniform than purely random, with some clustering)
      const dayBucket = Math.floor((i / final) * 45 + (rand() - 0.5) * 6);
      const day = Math.max(0, Math.min(44, dayBucket));
      // Bias hour toward 19:00-23:00 (evening games) or 13:00-16:00 (day games)
      const hourPick = rand();
      let hour;
      if (hourPick < 0.6) hour = 19 + Math.floor(rand() * 5);      // 19-23 evening
      else if (hourPick < 0.85) hour = 13 + Math.floor(rand() * 4); // 13-16 day
      else hour = Math.floor(rand() * 24);                          // anywhere
      const t = day * 24 + hour + Math.floor(rand() * 60) / 60;     // fractional hours
      events.push({ t, teamIdx, teamId: team.id, teamName: team.name });
    }
  });
  events.sort((a, b) => a.t - b.t);
  return events;
}

const HOURLY_EVENTS = buildHourlyEvents();

// Convert hour offset → wall-clock label
function hourToLabel(h) {
  const d = new Date(ASB_START.getTime() + h * 3600 * 1000);
  const day = Math.floor(h / 24) + 1;
  const hr = d.getUTCHours();
  const ampm = hr >= 12 ? 'PM' : 'AM';
  const hr12 = ((hr + 11) % 12) + 1;
  return `Day ${day} · ${hr12}${ampm}`;
}

// Cumulative HRs for team at time t (hours)
function cumulativeAt(teamIdx, t) {
  let n = 0;
  for (const e of HOURLY_EVENTS) {
    if (e.t > t) break;
    if (e.teamIdx === teamIdx) n++;
  }
  return n;
}

// Daily HR series for The Race timeline (45 days post-ASB)
const DAYS = 45;
function buildDailySeries() {
  const series = TEAMS.map((team, idx) => {
    // Build a realistic-looking running total ending at team.hrs
    const final = team.hrs;
    let cumulative = 0;
    const points = [];
    for (let d = 0; d < DAYS; d++) {
      const remaining = DAYS - d;
      // Stochastic-ish but deterministic based on team idx
      const dayHR = (final - cumulative) * (1 / remaining);
      // Some variance
      const noise = ((d * 7 + idx * 13) % 5) - 2;
      const inc = Math.max(0, Math.round(dayHR + noise * 0.3));
      cumulative = Math.min(final, cumulative + inc);
      points.push(cumulative);
    }
    // Force last point to exact final
    points[points.length - 1] = final;
    return { teamIdx: idx, teamName: team.name, points };
  });
  return series;
}

const DAILY_SERIES = buildDailySeries();

// MLB team list (for player-pool filter)
const MLB_TEAMS = ['ARI','ATH','ATL','BAL','BOS','CHC','CIN','CLE','COL','CWS','DET','HOU','KC','LAA','LAD','MIL','MIN','NYM','NYY','PHI','PIT','SD','SEA','SF','STL','TB','TEX','TOR','WSH'];

// Export to window
Object.assign(window, {
  POSITIONS,
  TEAM_COLORS,
  TEAMS,
  PLAYERS,
  DRAFT_PICKS,
  TEAM_ROSTERS,
  HOME_RUNS,
  DAILY_SERIES,
  HOURLY_EVENTS,
  HOURS_TOTAL,
  ASB_START,
  hourToLabel,
  cumulativeAt,
  MLB_TEAMS,
  DAYS,
});
