import { supabase } from '@/lib/supabase';
import type { DailyTeamHr, TeamStanding } from '@/lib/types';
import HeadToHead from '@/components/HeadToHead';

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

export default async function H2HPage() {
  const { daily, standings } = await getData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#f5c518]">Head to Head</h1>
        <p className="text-[#888] text-sm mt-1">Pick any two teams and see how they stack up</p>
      </div>
      <HeadToHead daily={daily} standings={standings} />
    </div>
  );
}
