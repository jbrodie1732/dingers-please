import { supabase } from '@/lib/supabase';
import type { PlayerStanding, TeamStanding } from '@/lib/types';
import RosterView from '@/components/RosterView';

export const revalidate = 0;

async function getData() {
  const [{ data: players }, { data: standings }] = await Promise.all([
    supabase
      .from('player_standings')
      .select('*')
      .order('total_hrs', { ascending: false }),
    supabase.from('team_standings').select('*').order('total_hrs', { ascending: false }),
  ]);
  return {
    players:   (players   || []) as PlayerStanding[],
    standings: (standings || []) as TeamStanding[],
  };
}

export default async function RosterPage() {
  const { players, standings } = await getData();

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

      <RosterView players={players} standings={standings} />
    </div>
  );
}
