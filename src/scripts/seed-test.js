// seed-test.js — Populate Supabase with fake teams, players, and home runs for testing.
// Run: node src/scripts/seed-test.js
// Run: node src/scripts/seed-test.js --wipe    (to clear all data first)
//
// Safe to run multiple times — uses upsert for teams/players and only adds HRs once.

require('dotenv').config();
const { supabase } = require('../db/client');
const DRAFT_CFG = require('../../config/draft.config');

const WIPE = process.argv.includes('--wipe');

// One real player per position per team — these are your placeholders until draft day
const ROSTER_TEMPLATE = [
  { position: 'C',   name: 'Cal Raleigh'          },
  { position: '1B',  name: 'Freddie Freeman'       },
  { position: '2B',  name: 'Jose Altuve'           },
  { position: '3B',  name: 'Austin Riley'          },
  { position: 'SS',  name: 'Francisco Lindor'      },
  { position: 'LF',  name: 'Kyle Schwarber'        },
  { position: 'CF',  name: 'Mike Trout'            },
  { position: 'RF',  name: 'Aaron Judge'           },
  { position: 'DH',  name: 'Yordan Alvarez'        },
];

// Each team gets a different rotation of these players (just for testing)
const ALL_TEST_PLAYERS = [
  { position: 'C',  names: ['Cal Raleigh','William Contreras','Adley Rutschman','Sean Murphy','Tyler Stephenson','Danny Jansen','Gabriel Moreno','Patrick Bailey','Logan O\'Hoppe','Ryan Jeffers'] },
  { position: '1B', names: ['Freddie Freeman','Paul Goldschmidt','Vladimir Guerrero Jr.','Pete Alonso','Rhys Hoskins','Anthony Rizzo','Matt Olson','Spencer Torkelson','Josh Bell','Nathaniel Lowe'] },
  { position: '2B', names: ['Jose Altuve','Marcus Semien','Jeff McNeil','Ozzie Albies','Gleyber Torres','Nico Hoerner','Andrés Giménez','Luis Arraez','Gavin Lux','Brendan Donovan'] },
  { position: '3B', names: ['Austin Riley','Manny Machado','Rafael Devers','Nolan Arenado','José Ramírez','Gunnar Henderson','Josh Jung','Eugenio Suárez','Ryan McMahon','Ke\'Bryan Hayes'] },
  { position: 'SS', names: ['Francisco Lindor','Trea Turner','Corey Seager','Bo Bichette','Xander Bogaerts','Carlos Correa','Dansby Swanson','Willy Adames','Anthony Volpe','Bobby Witt Jr.'] },
  { position: 'LF', names: ['Kyle Schwarber','Liam Hendricks','Randy Arozarena','Ian Happ','Brandon Nimmo','David Peralta','Jordan Walker','Alex Verdugo','Cody Bellinger','Michael Brantley'] },
  { position: 'CF', names: ['Mike Trout','Julio Rodríguez','Corbin Carroll','Cedric Mullins','Michael A. Taylor','Harrison Bader','Mookie Betts','Byron Buxton','Starling Marte','Luis Robert'] },
  { position: 'RF', names: ['Aaron Judge','Fernando Tatis Jr.','Ronald Acuña Jr.','Seiya Suzuki','Nick Castellanos','Lars Nootbaar','Juan Soto','Teoscar Hernández','Kris Bryant','Bryce Harper'] },
  { position: 'DH', names: ['Yordan Alvarez','J.D. Martinez','Giancarlo Stanton','Nelson Cruz','Marcell Ozuna','Edwin Encarnación','Harold Ramirez','Seth Brown','Tyler O\'Neill','Miguel Sano'] },
];

// Generate realistic-looking HR data
function randomHR(gamePk, atBatIndex, playerId, gameDate, batterId) {
  const distances = [370, 385, 390, 400, 405, 410, 415, 420, 425, 430, 435, 440, 445, 452, 460, 470];
  const distance  = distances[Math.floor(Math.random() * distances.length)];
  const la        = 22 + Math.floor(Math.random() * 20);
  const ev        = 98 + Math.floor(Math.random() * 18);
  // Spray: random but between foul lines (x: 40-210, y: 20-160)
  const sprayX    = 60 + Math.floor(Math.random() * 110);
  const sprayY    = 30 + Math.floor(Math.random() * 100);
  return {
    player_id:          playerId,
    game_pk:            gamePk,
    at_bat_index:       atBatIndex,
    batter_mlb_id:      batterId,
    distance,
    launch_angle:       la,
    launch_speed:       ev,
    spray_x:            sprayX,
    spray_y:            sprayY,
    mickey_meter_count: 10 + Math.floor(Math.random() * 18),
    mickey_meter_label: '50% Goofy',
    game_date:          gameDate,
    hit_at:             new Date(gameDate + 'T' + (18 + Math.floor(Math.random() * 4)).toString().padStart(2,'0') + ':' + Math.floor(Math.random()*60).toString().padStart(2,'0') + ':00Z').toISOString(),
  };
}

async function wipe() {
  console.log('🗑️  Wiping all data...');
  await supabase.from('draft_picks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('home_runs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('✅ Done wiping\n');
}

async function main() {
  if (WIPE) await wipe();

  const teamNames = DRAFT_CFG.teams;
  console.log(`🏈 Seeding ${teamNames.length} teams...`);

  // 1. Upsert teams
  const { data: teams, error: teamsErr } = await supabase
    .from('teams')
    .upsert(teamNames.map(name => ({ name })), { onConflict: 'name' })
    .select();
  if (teamsErr) { console.error('Teams error:', teamsErr.message); process.exit(1); }
  const teamMap = Object.fromEntries(teams.map(t => [t.name, t.id]));
  console.log(`  ✅ ${teams.length} teams upserted`);

  // 2. Upsert players (one per position per team)
  console.log(`\n👤 Seeding players...`);
  const playerInserts = [];
  for (let ti = 0; ti < teamNames.length; ti++) {
    const teamName = teamNames[ti];
    const teamId   = teamMap[teamName];
    for (const posRow of ALL_TEST_PLAYERS) {
      playerInserts.push({
        name:     posRow.names[ti],
        team_id:  teamId,
        position: posRow.position,
      });
    }
  }
  // Deduplicate by name before upserting (guards against cross-position name collisions)
  const seen = new Set();
  const dedupedInserts = playerInserts.filter(p => {
    if (seen.has(p.name)) return false;
    seen.add(p.name);
    return true;
  });

  const { data: players, error: playersErr } = await supabase
    .from('players')
    .upsert(dedupedInserts, { onConflict: 'name' })
    .select();
  if (playersErr) { console.error('Players error:', playersErr.message); process.exit(1); }
  const playerMap = Object.fromEntries(players.map(p => [p.name, p]));
  console.log(`  ✅ ${players.length} players upserted`);

  // 3. Generate fake home runs
  // Simulate ~60 days of games (roughly July 15 – Sept 15)
  console.log(`\n⚾  Generating test home runs...`);
  const hrInserts = [];
  let gamePk      = 800000;
  let overallAtBat = 0;

  // Give each team a random "pace" so standings look interesting
  const teamPace = Object.fromEntries(teamNames.map(t => [t, 0.5 + Math.random() * 1.5]));

  for (let day = 0; day < 62; day++) {
    const d    = new Date('2026-07-15');
    d.setDate(d.getDate() + day);
    const date = d.toISOString().split('T')[0];
    gamePk++;

    // Each day: go through every player on every team
    for (const playerRow of players) {
      const teamName = teams.find(t => t.id === playerRow.team_id)?.name;
      if (!teamName) continue;
      const pace = teamPace[teamName] || 1;
      // Probability of HR on a given day ~proportional to pace
      // Average is about 0.8 HRs per player across the whole season for drafted players
      const prob = (pace * 0.8) / 62;
      if (Math.random() < prob) {
        overallAtBat++;
        hrInserts.push(randomHR(gamePk, overallAtBat, playerRow.id, date, overallAtBat));
      }
    }
  }

  // Deduplicate by (game_pk, at_bat_index)
  const { error: hrErr } = await supabase
    .from('home_runs')
    .upsert(hrInserts, { onConflict: 'game_pk,at_bat_index' });
  if (hrErr) { console.error('HR insert error:', hrErr.message); process.exit(1); }
  console.log(`  ✅ ${hrInserts.length} home runs inserted`);

  // 4. Print standings preview
  console.log(`\n🏆 Standings preview:`);
  const { data: standings } = await supabase
    .from('team_standings')
    .select('*')
    .order('total_hrs', { ascending: false });
  if (standings) {
    standings.forEach((t, i) => console.log(`  ${i + 1}. ${t.team_name}: ${t.total_hrs} HRs`));
  }

  console.log(`\n✅ Seed complete! Start the web app with: cd web && npm run dev`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
