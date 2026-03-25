import { supabase } from '@/lib/supabase';
import type { DailyTeamHr } from '@/lib/types';
import TimelineChart from '@/components/TimelineChart';

export const revalidate = 0;

async function getDailyData(): Promise<DailyTeamHr[]> {
  const { data } = await supabase
    .from('daily_team_hrs')
    .select('*')
    .order('game_date', { ascending: true });
  return data || [];
}

export default async function TimelinePage() {
  const dailyData = await getDailyData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#f5c518]">The Race</h1>
        <p className="text-[#888] text-sm mt-1">Cumulative home runs per team over the season</p>
      </div>
      <TimelineChart dailyData={dailyData} />
    </div>
  );
}
