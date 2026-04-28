import { supabase } from '@/lib/supabase';
import type { DailyTeamHr } from '@/lib/types';
import TimelineChart, { type HourlyHR } from '@/components/TimelineChart';

export const revalidate = 0;

async function getDailyData(): Promise<DailyTeamHr[]> {
  const { data } = await supabase
    .from('daily_team_hrs')
    .select('*')
    .order('game_date', { ascending: true });
  return data || [];
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

export default async function TimelinePage() {
  const [dailyData, hourlyHRs] = await Promise.all([getDailyData(), getHourlyHRs()]);

  return (
    <div className="screen">
      <div className="hero-header">
        <div className="hero-eyebrow">CUMULATIVE HRS · POST-ASB</div>
        <h1 className="hero-title">The Race</h1>
        <div className="hero-meta">
          <span>Season <b>2026</b></span>
          <span className="dot-sep">·</span>
          <span><b>{hourlyHRs.length}</b> total dingers</span>
        </div>
      </div>

      <TimelineChart dailyData={dailyData} hourlyHRs={hourlyHRs} />
    </div>
  );
}
