import { supabase } from '@/lib/supabase';
import type { PlayerStanding, TeamStanding } from '@/lib/types';
import RosterView from '@/components/RosterView';

export const revalidate = 0;

async function getData() {
  const [{ data: players }, { data: standings }, { data: pool }] = await Promise.all([
    supabase
      .from('player_standings')
      .select('*')
      .order('total_hrs', { ascending: false }),
    supabase.from('team_standings').select('*').order('total_hrs', { ascending: false }),
    // player_standings doesn't expose mlb_player_id, so pull the id↔mlb_id map
    // straight from the players table to join each roster player to its Statcast
    // stats (keyed by mlb_player_id) for the radar chart.
    supabase.from('players').select('id, mlb_player_id'),
  ]);

  const mlbIdByUuid: Record<string, number | null> = {};
  for (const row of (pool || []) as { id: string; mlb_player_id: number | null }[]) {
    mlbIdByUuid[row.id] = row.mlb_player_id ?? null;
  }

  return {
    players:   (players   || []) as PlayerStanding[],
    standings: (standings || []) as TeamStanding[],
    mlbIdByUuid,
  };
}

export default async function RosterPage() {
  const { players, standings, mlbIdByUuid } = await getData();

  return (
    <div className="screen">
      <div className="hero-header">
        <div className="hero-eyebrow">9 STARTERS · ONE PER POSITION</div>
        <h1 className="hero-title">Rosters</h1>
        <div className="hero-meta">
          <span><b>{standings.length}</b> teams</span>
          <span className="dot-sep">·</span>
          <span><b>{players.length}</b> players</span>
        </div>
      </div>

      <RosterView players={players} standings={standings} mlbIdByUuid={mlbIdByUuid} />
    </div>
  );
}
