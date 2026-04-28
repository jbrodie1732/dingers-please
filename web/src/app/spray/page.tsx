import { supabase } from '@/lib/supabase';
import type { HomeRun, TeamStanding } from '@/lib/types';
import SprayChart from '@/components/SprayChart';

export const revalidate = 0;

async function getData() {
  const [{ data: hrs }, { data: standings }] = await Promise.all([
    supabase
      .from('home_runs')
      .select('*, players(name, position, team_id, teams(name))')
      .not('spray_x', 'is', null)
      .not('spray_y', 'is', null),
    supabase.from('team_standings').select('*').order('total_hrs', { ascending: false }),
  ]);
  return { hrs: (hrs || []) as HomeRun[], standings: (standings || []) as TeamStanding[] };
}

export default async function SprayPage() {
  const { hrs, standings } = await getData();

  return (
    <div className="screen">
      <div className="hero-header">
        <div className="hero-eyebrow">SPRAY CHART · {standings.length} LEAGUE TEAMS</div>
        <h1 className="hero-title">Where It Landed</h1>
        <div className="hero-meta">
          <span><b>{hrs.length}</b> tracked dingers</span>
        </div>
      </div>

      <SprayChart homeRuns={hrs} standings={standings} />
    </div>
  );
}
