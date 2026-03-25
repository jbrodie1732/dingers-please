import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ROUNDS     = 9;
const TEAM_COUNT = 10;
const SEASON     = 2026;

// Server-only client (service role bypasses RLS)
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

// Build the full snake pick order: returns array of { round, teamIndex, pickInRound, overall }
function buildPickOrder(teamCount: number, rounds: number) {
  const picks = [];
  let overall = 0;
  for (let r = 1; r <= rounds; r++) {
    const snake = r % 2 === 0;
    for (let p = 0; p < teamCount; p++) {
      overall++;
      picks.push({
        round:       r,
        teamIndex:   snake ? teamCount - 1 - p : p,
        pickInRound: p + 1,
        overall,
      });
    }
  }
  return picks;
}

export async function POST(req: NextRequest) {
  const { adminPin, playerId } = await req.json();

  if (!adminPin || adminPin !== process.env.ADMIN_PIN) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
  }
  if (!playerId) {
    return NextResponse.json({ error: 'No player selected' }, { status: 400 });
  }

  const db = adminClient();

  // Load teams in draft order
  const { data: teams } = await db
    .from('teams')
    .select('id, name, draft_position')
    .order('draft_position');

  if (!teams?.length) return NextResponse.json({ error: 'No teams found' }, { status: 400 });

  // Current pick = number of picks already made
  const { count: pickCount } = await db
    .from('draft_picks')
    .select('*', { count: 'exact', head: true })
    .eq('season', SEASON);

  const currentIdx = pickCount ?? 0;
  const pickOrder  = buildPickOrder(TEAM_COUNT, ROUNDS);

  if (currentIdx >= pickOrder.length) {
    return NextResponse.json({ error: 'Draft is complete' }, { status: 400 });
  }

  const currentPick = pickOrder[currentIdx];
  const currentTeam = teams[currentPick.teamIndex];
  if (!currentTeam) return NextResponse.json({ error: 'Could not determine current team' }, { status: 500 });

  // Load the player being drafted (must be undrafted)
  const { data: player } = await db
    .from('players')
    .select('id, name, position, team_id')
    .eq('id', playerId)
    .is('team_id', null)
    .single();

  if (!player) {
    return NextResponse.json({ error: 'Player not available or already drafted' }, { status: 400 });
  }

  // Check the current team doesn't already have this position
  const { count: posCount } = await db
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', currentTeam.id)
    .eq('position', player.position);

  if ((posCount ?? 0) > 0) {
    return NextResponse.json({
      error: `${currentTeam.name} already has a ${player.position}`,
    }, { status: 400 });
  }

  // Commit the pick atomically
  const [{ error: playerErr }, { error: pickErr }] = await Promise.all([
    db.from('players')
      .update({ team_id: currentTeam.id })
      .eq('id', player.id),
    db.from('draft_picks')
      .insert({
        season:        SEASON,
        round:         currentPick.round,
        pick_in_round: currentPick.pickInRound,
        overall_pick:  currentPick.overall,
        player_id:     player.id,
        team_id:       currentTeam.id,
      }),
  ]);

  if (playerErr || pickErr) {
    return NextResponse.json({ error: playerErr?.message ?? pickErr?.message }, { status: 500 });
  }

  return NextResponse.json({
    success:     true,
    team:        currentTeam.name,
    player:      player.name,
    position:    player.position,
    round:       currentPick.round,
    overallPick: currentPick.overall,
  });
}
