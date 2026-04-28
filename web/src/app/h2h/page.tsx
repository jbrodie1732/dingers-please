import { supabase } from '@/lib/supabase';
import type { DailyTeamHr, TeamStanding } from '@/lib/types';
import HeadToHead from '@/components/HeadToHead';
import type { HourlyHR } from '@/components/TimelineChart';

export const revalidate = 0;

async function getData() {
  const [{ data: daily }, { data: standings }] = await Promise.all([
    supabase.from('daily_team_hrs').select('*').order('game_date', { ascending: true }),
    supabase.from('team_standings').select('*').order('total_hrs', { ascending: false }),
  ]);
  return {
    daily:     (daily     || []) as DailyTeamHr[],
    standings: (standings || []) as TeamStanding[],
  };
}

async function getHourlyHRs(): Promise<HourlyHR[]> {
  const { data } = await supabase
    .from('home_runs')
    .select('hit_at, players(team_id)')
    .order('hit_at', { ascending: true });

  return (data ?? [])
    .filter((r: any) => r.players?.team_id)
    .map((r: any) => ({ hit_at: r.hit_at as string, team_id: r.players.team_id as string }));
}

export default async function H2HPage() {
  const [{ daily, standings }, hourlyHRs] = await Promise.all([getData(), getHourlyHRs()]);

  return (
    <div className="screen">
      <div className="hero-header">
        <div className="hero-eyebrow">SIDE BY SIDE</div>
        <h1 className="hero-title">Head to Head</h1>
        <div className="hero-meta">
          <span>Pick any two teams</span>
          <span className="dot-sep">·</span>
          <span>Static or Real-Time</span>
        </div>
      </div>

      <HeadToHead daily={daily} standings={standings} hourlyHRs={hourlyHRs} />
    </div>
  );
}
