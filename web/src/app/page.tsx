import { supabase } from '@/lib/supabase';
import type { TeamStanding, HomeRun } from '@/lib/types';
import StandingsTable from '@/components/StandingsTable';
import RealtimeFeed from '@/components/RealtimeFeed';

export const revalidate = 0;

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
    .select('*, players(name, position, team_id, teams(name))')
    .order('hit_at', { ascending: false })
    .limit(15);
  return data || [];
}

async function getTotalHRs(): Promise<number> {
  const { count } = await supabase
    .from('home_runs')
    .select('id', { count: 'exact', head: true });
  return count ?? 0;
}

export default async function HomePage() {
  const [standings, recentHRs, totalHRs] = await Promise.all([
    getStandings(),
    getRecentHRs(),
    getTotalHRs(),
  ]);

  return (
    <div className="screen">
      <div className="hero-header">
        <div className="hero-eyebrow">SEASON 2026</div>
        <h1 className="hero-title">Standings</h1>
        <div className="hero-meta">
          <span><b>{totalHRs}</b> dingers logged</span>
          <span className="dot-sep">·</span>
          <span><b>{standings.length}</b> teams</span>
          <span className="dot-sep">·</span>
          <span>Updated <b>live</b></span>
        </div>
      </div>

      <div className="standings-grid">
        <StandingsTable initialStandings={standings} />
        <RealtimeFeed initialHRs={recentHRs} />
      </div>
    </div>
  );
}
