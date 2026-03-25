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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#f5c518]">Rosters</h1>
        <p className="text-[#888] text-sm mt-1">Team-by-team breakdown</p>
      </div>
      <RosterView players={players} standings={standings} />
    </div>
  );
}
