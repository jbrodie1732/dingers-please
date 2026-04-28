import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SEASON = 2026;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

function unauthorized() {
  return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { adminPin, action } = body;

  if (!adminPin || adminPin !== process.env.ADMIN_PIN) return unauthorized();

  const db = adminClient();

  // ── verify ───────────────────────────────────────────────────────────────
  if (action === 'verify') {
    return NextResponse.json({ success: true });
  }

  // ── reset-draft ──────────────────────────────────────────────────────────
  if (action === 'reset-draft') {
    const [{ error: pickErr }, { error: playerErr }] = await Promise.all([
      db.from('draft_picks').delete().eq('season', SEASON),
      db.from('players').update({ team_id: null }).not('id', 'is', null),
    ]);
    if (pickErr || playerErr) {
      return NextResponse.json({ error: pickErr?.message ?? playerErr?.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: 'Draft reset. All picks deleted, all players unassigned.' });
  }

  // ── wipe ─────────────────────────────────────────────────────────────────
  if (action === 'wipe') {
    const FAKE_ID = '00000000-0000-0000-0000-000000000000';
    await db.from('draft_picks').delete().neq('id', FAKE_ID);
    await db.from('home_runs').delete().neq('id', FAKE_ID);
    await db.from('transactions').delete().neq('id', FAKE_ID);
    await db.from('players').delete().neq('id', FAKE_ID);
    await db.from('teams').delete().neq('id', FAKE_ID);
    return NextResponse.json({ success: true, message: 'All data wiped. Run load-player-pool locally to restore the player pool.' });
  }

  // ── set-add-drop-limit ───────────────────────────────────────────────────
  if (action === 'set-add-drop-limit') {
    const { limit } = body;
    if (typeof limit !== 'number' || limit < 0) {
      return NextResponse.json({ error: 'Invalid limit' }, { status: 400 });
    }
    const { error } = await db
      .from('season_config')
      .upsert({ season: SEASON, add_drop_limit: limit }, { onConflict: 'season' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: `Add/drop limit set to ${limit}` });
  }

  // ── add-drop ─────────────────────────────────────────────────────────────
  if (action === 'add-drop') {
    const { teamId, dropPlayerId, addPlayerName, notes } = body;
    if (!teamId || !dropPlayerId || !addPlayerName?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check budget
    const [{ data: config }, { count: usedCount }] = await Promise.all([
      db.from('season_config').select('add_drop_limit').eq('season', SEASON).single(),
      db.from('transactions').select('*', { count: 'exact', head: true }).eq('team_id', teamId).eq('season', SEASON),
    ]);
    const limit = config?.add_drop_limit ?? 2;
    const used  = usedCount ?? 0;
    if (used >= limit) {
      return NextResponse.json({ error: `This team has used all ${limit} add/drops` }, { status: 400 });
    }

    // Load the player being dropped
    const { data: droppedPlayer } = await db
      .from('players')
      .select('id, name, position')
      .eq('id', dropPlayerId)
      .is('dropped_at', null)
      .single();
    if (!droppedPlayer) {
      return NextResponse.json({ error: 'Player not found or already dropped' }, { status: 400 });
    }

    const effectiveNow = new Date().toISOString();

    // 1. Mark dropped player
    const { error: dropErr } = await db
      .from('players')
      .update({ dropped_at: effectiveNow })
      .eq('id', dropPlayerId);
    if (dropErr) return NextResponse.json({ error: dropErr.message }, { status: 500 });

    // 2. Insert added player (same position slot)
    const { data: addedPlayer, error: addErr } = await db
      .from('players')
      .insert({
        name:     addPlayerName.trim(),
        team_id:  teamId,
        position: droppedPlayer.position,
        added_at: effectiveNow,
      })
      .select()
      .single();
    if (addErr) return NextResponse.json({ error: addErr.message }, { status: 500 });

    // 3. Record transaction
    const { error: txErr } = await db.from('transactions').insert({
      season: SEASON,
      team_id:           teamId,
      dropped_player_id: dropPlayerId,
      added_player_id:   addedPlayer.id,
      effective_at:      effectiveNow,
      notes:             notes?.trim() || null,
    });
    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      message: `Dropped ${droppedPlayer.name}, added ${addPlayerName.trim()} (${droppedPlayer.position}). Remember to run fetch-mlb-ids:save and restart the watcher.`,
    });
  }

  // ── log-hr ───────────────────────────────────────────────────────────────
  if (action === 'log-hr') {
    const { playerName, teamId, distance, launchSpeed, launchAngle } = body;
    if (!playerName?.trim() || !teamId) {
      return NextResponse.json({ error: 'Player name and team required' }, { status: 400 });
    }
    const { data: player, error: findErr } = await db
      .from('players')
      .select('id, name, position')
      .eq('team_id', teamId)
      .ilike('name', `%${playerName.trim()}%`)
      .is('dropped_at', null)
      .limit(1)
      .single();
    if (findErr || !player) {
      return NextResponse.json({ error: `No active player matching "${playerName}" on that team` }, { status: 400 });
    }
    const now = new Date().toISOString();
    const { error: insertErr } = await db.from('home_runs').insert({
      player_id:    player.id,
      game_pk:      Math.floor(Date.now() / 1000),
      at_bat_index: 0,
      distance:     distance || null,
      launch_speed: launchSpeed || null,
      launch_angle: launchAngle || null,
      game_date:    now.slice(0, 10),
      hit_at:       now,
    });
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    return NextResponse.json({ success: true, message: `HR logged for ${player.name} (${player.position}).` });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
