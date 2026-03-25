import { supabase } from '@/lib/supabase';
import type { TeamStanding, HomeRun } from '@/lib/types';
import StandingsTable from '@/components/StandingsTable';
import RealtimeFeed from '@/components/RealtimeFeed';

export const revalidate = 0; // always fresh on server render

async function getStandings(): Promise<TeamStanding[]> {
  const { data } = await supabase
    .from('team_standings')
    .select('*')
    .order('total_hrs', { ascending: false });
  return data || [];
}

async function getRecentHRs(): Promise<HomeRun[]> {
  const { data } = await supabase
    .from('home_runs')
    .select('*, players(name, position, teams(name))')
    .order('hit_at', { ascending: false })
    .limit(15);
  return data || [];
}

export default async function HomePage() {
  const [standings, recentHRs] = await Promise.all([getStandings(), getRecentHRs()]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#f5c518]">⚾ Dinger Tracker</h1>
        <p className="text-[#888] mt-1 text-sm">Post All-Star Break · 2025</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Standings — takes up 2/3 width on large screens */}
        <div className="lg:col-span-2">
          <StandingsTable initialStandings={standings} />
        </div>

        {/* Live feed — right column */}
        <div>
          <RealtimeFeed initialHRs={recentHRs} />
        </div>
      </div>
    </div>
  );
}
