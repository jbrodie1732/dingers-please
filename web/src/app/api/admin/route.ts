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

// ── add/drop helpers ─────────────────────────────────────────────────────────
// The added player almost always already exists in the pool (loaded by
// load-player-pool with team_id = null). players.name is UNIQUE, so we must
// REUSE that existing row rather than INSERTing a duplicate — inserting a
// duplicate name throws and, because the drop is committed first, used to leave
// the roster stuck with a dropped player and no replacement.
type Db = ReturnType<typeof adminClient>;
type Resolved =
  | { mode: 'reuse'; id: string; name: string }
  | { mode: 'insert'; name: string }
  | { error: string };

// Read-only: figure out whether the add target already exists, WITHOUT writing.
// Call this before dropping so a bad/duplicate/rostered add can't orphan a drop.
async function resolveAddTarget(db: Db, addName: string): Promise<Resolved> {
  const { data: rows } = await db
    .from('players')
    .select('id, name, team_id, dropped_at')
    .ilike('name', addName) // exact match, case-insensitive (no wildcards)
    .limit(1);
  const existing = rows?.[0];
  if (existing) {
    const activeRostered = existing.team_id !== null && existing.dropped_at === null;
    if (activeRostered) return { error: `${existing.name} is already on a roster` };
    return { mode: 'reuse', id: existing.id, name: existing.name };
  }
  return { mode: 'insert', name: addName };
}

type Committed = { id: string; name: string; reused: boolean } | { error: string };

// Writes: either reassign the existing pool row into this team's slot (keeping
// its mlb_player_id so the watcher still matches it), or insert a brand-new row.
async function commitAdd(
  db: Db, resolved: Resolved, teamId: string, position: string, effectiveNow: string,
): Promise<Committed> {
  if ('error' in resolved) return { error: resolved.error };
  if (resolved.mode === 'reuse') {
    const { data, error } = await db
      .from('players')
      .update({ team_id: teamId, position, added_at: effectiveNow, dropped_at: null })
      .eq('id', resolved.id)
      .select('id, name')
      .single();
    if (error || !data) return { error: error?.message ?? 'Failed to add player' };
    return { id: data.id, name: data.name, reused: true };
  }
  const { data, error } = await db
    .from('players')
    .insert({ name: resolved.name, team_id: teamId, position, added_at: effectiveNow })
    .select('id, name')
    .single();
  if (error || !data) return { error: error?.message ?? 'Failed to add player' };
  return { id: data.id, name: data.name, reused: false };
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

  // ── undo-last-pick ───────────────────────────────────────────────────────
  // Un-drafts whoever was picked most recently and deletes that pick record.
  // Safe to click repeatedly — each call just undoes the new "most recent" pick.
  if (action === 'undo-last-pick') {
    const { data: lastPick, error: findErr } = await db
      .from('draft_picks')
      .select('id, round, pick_in_round, overall_pick, player_id, team_id, players(name, position), teams(name)')
      .eq('season', SEASON)
      .order('overall_pick', { ascending: false })
      .limit(1)
      .single();

    if (findErr || !lastPick) {
      return NextResponse.json({ error: 'No picks to undo' }, { status: 400 });
    }

    const [{ error: playerErr }, { error: pickErr }] = await Promise.all([
      db.from('players').update({ team_id: null }).eq('id', lastPick.player_id),
      db.from('draft_picks').delete().eq('id', lastPick.id),
    ]);
    if (playerErr || pickErr) {
      return NextResponse.json({ error: playerErr?.message ?? pickErr?.message }, { status: 500 });
    }

    const playerName = (lastPick.players as any)?.name ?? 'Player';
    const teamName    = (lastPick.teams as any)?.name ?? 'team';
    return NextResponse.json({
      success: true,
      message: `Undid pick #${lastPick.overall_pick} (Rd ${lastPick.round}, Pick ${lastPick.pick_in_round}): ${playerName} → ${teamName}. Player is available again.`,
    });
  }

  // ── override-pick ────────────────────────────────────────────────────────
  // Swaps the player on an existing pick for a different currently-available
  // player at the same position, without touching round/pick numbering or
  // any other pick. Use this to fix "we drafted the wrong guy" without
  // rewinding everything after it.
  if (action === 'override-pick') {
    const { pickId, newPlayerId } = body;
    if (!pickId || !newPlayerId) {
      return NextResponse.json({ error: 'pickId and newPlayerId are required' }, { status: 400 });
    }

    const { data: pick, error: pickFindErr } = await db
      .from('draft_picks')
      .select('id, team_id, player_id, round, pick_in_round, overall_pick, players(name, position), teams(name)')
      .eq('id', pickId)
      .single();
    if (pickFindErr || !pick) {
      return NextResponse.json({ error: 'Pick not found' }, { status: 400 });
    }

    const oldPlayerName = (pick.players as any)?.name ?? 'that player';
    const oldPosition   = (pick.players as any)?.position;
    const teamName      = (pick.teams as any)?.name ?? 'the team';

    const { data: newPlayer, error: newPlayerErr } = await db
      .from('players')
      .select('id, name, position, team_id')
      .eq('id', newPlayerId)
      .single();
    if (newPlayerErr || !newPlayer) {
      return NextResponse.json({ error: 'Replacement player not found' }, { status: 400 });
    }
    if (newPlayer.team_id !== null) {
      return NextResponse.json({ error: `${newPlayer.name} is already on a roster` }, { status: 400 });
    }
    if (newPlayer.position !== oldPosition) {
      return NextResponse.json({
        error: `${newPlayer.name} is a ${newPlayer.position}, but this pick is for a ${oldPosition}`,
      }, { status: 400 });
    }

    const [{ error: freeErr }, { error: assignErr }, { error: pickUpdateErr }] = await Promise.all([
      db.from('players').update({ team_id: null }).eq('id', pick.player_id),
      db.from('players').update({ team_id: pick.team_id }).eq('id', newPlayer.id),
      db.from('draft_picks').update({ player_id: newPlayer.id }).eq('id', pick.id),
    ]);
    if (freeErr || assignErr || pickUpdateErr) {
      return NextResponse.json({ error: freeErr?.message ?? assignErr?.message ?? pickUpdateErr?.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Pick #${pick.overall_pick} (Rd ${pick.round}, Pick ${pick.pick_in_round}): ${oldPlayerName} → ${newPlayer.name} on ${teamName}. ${oldPlayerName} is available again.`,
    });
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
      .select('id, name, position, team_id')
      .eq('id', dropPlayerId)
      .is('dropped_at', null)
      .single();
    if (!droppedPlayer || droppedPlayer.team_id !== teamId) {
      return NextResponse.json({ error: 'Player not found or already dropped' }, { status: 400 });
    }

    // Resolve the add target BEFORE dropping anyone. If the add can't proceed
    // (already rostered, etc.) we bail out with the drop still intact — so a
    // failed add can never leave the roster stuck with an empty slot.
    const resolved = await resolveAddTarget(db, addPlayerName.trim());
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const effectiveNow = new Date().toISOString();

    // 1. Mark dropped player
    const { error: dropErr } = await db
      .from('players')
      .update({ dropped_at: effectiveNow })
      .eq('id', dropPlayerId);
    if (dropErr) return NextResponse.json({ error: dropErr.message }, { status: 500 });

    // 2. Add the replacement (reuse existing pool row, or insert new)
    const added = await commitAdd(db, resolved, teamId, droppedPlayer.position, effectiveNow);
    if ('error' in added) {
      // Roll the drop back so we don't leave an orphaned open slot.
      await db.from('players').update({ dropped_at: null }).eq('id', dropPlayerId);
      return NextResponse.json({ error: added.error }, { status: 500 });
    }

    // 3. Record transaction
    const { error: txErr } = await db.from('transactions').insert({
      season: SEASON,
      team_id:           teamId,
      dropped_player_id: dropPlayerId,
      added_player_id:   added.id,
      effective_at:      effectiveNow,
      notes:             notes?.trim() || null,
    });
    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      message: `Dropped ${droppedPlayer.name}, added ${added.name} (${droppedPlayer.position}).` +
        (added.reused ? '' : ' New name not in the pool — run fetch-mlb-ids:save and restart the watcher.'),
    });
  }

  // ── fill-slot (recovery) ───────────────────────────────────────────────────
  // Fills an OPEN roster slot — a player who was dropped but never got a
  // replacement (e.g. an add that errored after the drop committed). No new
  // drop required; records the transaction retroactively at the drop time.
  if (action === 'fill-slot') {
    const { teamId, droppedPlayerId, addPlayerName, notes } = body;
    if (!teamId || !droppedPlayerId || !addPlayerName?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Budget
    const [{ data: config }, { count: usedCount }] = await Promise.all([
      db.from('season_config').select('add_drop_limit').eq('season', SEASON).single(),
      db.from('transactions').select('*', { count: 'exact', head: true }).eq('team_id', teamId).eq('season', SEASON),
    ]);
    const limit = config?.add_drop_limit ?? 2;
    if ((usedCount ?? 0) >= limit) {
      return NextResponse.json({ error: `This team has used all ${limit} add/drops` }, { status: 400 });
    }

    // The orphaned dropped player (already dropped, on this team)
    const { data: dropped } = await db
      .from('players')
      .select('id, name, position, team_id, dropped_at')
      .eq('id', droppedPlayerId)
      .single();
    if (!dropped || dropped.team_id !== teamId || !dropped.dropped_at) {
      return NextResponse.json({ error: 'That is not an open (dropped) slot for this team' }, { status: 400 });
    }

    // Confirm the slot is actually empty (no active same-position player)
    const { data: activeAtPos } = await db
      .from('players')
      .select('id')
      .eq('team_id', teamId)
      .eq('position', dropped.position)
      .is('dropped_at', null)
      .limit(1);
    if (activeAtPos && activeAtPos.length > 0) {
      return NextResponse.json({ error: `${dropped.position} already has an active player` }, { status: 400 });
    }

    const resolved = await resolveAddTarget(db, addPlayerName.trim());
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const effectiveNow = new Date().toISOString();
    const added = await commitAdd(db, resolved, teamId, dropped.position, effectiveNow);
    if ('error' in added) {
      return NextResponse.json({ error: added.error }, { status: 500 });
    }

    // Record the transaction retroactively (dated to when the drop happened)
    const { error: txErr } = await db.from('transactions').insert({
      season: SEASON,
      team_id:           teamId,
      dropped_player_id: dropped.id,
      added_player_id:   added.id,
      effective_at:      dropped.dropped_at,
      notes:             notes?.trim() || null,
    });
    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      message: `Filled the ${dropped.position} slot: added ${added.name} to replace ${dropped.name}.` +
        (added.reused ? '' : ' New name not in the pool — run fetch-mlb-ids:save and restart the watcher.'),
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
