import { supabase } from '@/lib/supabase';
import type { HomeRun, TeamStanding } from '@/lib/types';
import DataRoom from '@/components/DataRoom';

export const revalidate = 0;

// Every counted home run, oldest → newest, so the client can assign each HR its
// running per-player and per-team sequence number ("player HR #", "team HR #").
async function getAllHomeRuns(): Promise<HomeRun[]> {
  const { data } = await supabase
    .from('home_runs')
    .select('*, players(name, position, team_id, teams(name, draft_position))')
    .order('hit_at', { ascending: true });
  return data || [];
}

// Full team list (incl. teams with zero HRs) so "cold" stats can see everyone.
async function getStandings(): Promise<TeamStanding[]> {
  const { data } = await supabase
    .from('team_standings')
    .select('*')
    .order('total_hrs', { ascending: false });
  return data || [];
}

export default async function DataRoomPage() {
  const [homeRuns, standings] = await Promise.all([getAllHomeRuns(), getStandings()]);

  return (
    <div className="screen">
      <div className="hero-header">
        <div className="hero-eyebrow">RECEIPTS</div>
        <h1 className="hero-title">Dataroom</h1>
        <div className="hero-meta">
          <span><b>{homeRuns.length}</b> dingers on record</span>
          <span className="dot-sep">·</span>
          <span>Every home run we&apos;re counting, sortable &amp; filterable</span>
        </div>
      </div>

      <DataRoom homeRuns={homeRuns} standings={standings} />
    </div>
  );
}
