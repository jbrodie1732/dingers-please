import { supabase } from '@/lib/supabase';
import type { HomeRun, TeamStanding } from '@/lib/types';
import SprayChart from '@/components/SprayChart';

export const revalidate = 0;

async function getData() {
  const [{ data: hrs }, { data: standings }] = await Promise.all([
    supabase
      .from('home_runs')
      .select('*, players(name, position, teams(name))')
      .not('spray_x', 'is', null)
      .not('spray_y', 'is', null),
    supabase.from('team_standings').select('*').order('total_hrs', { ascending: false }),
  ]);
  return { hrs: (hrs || []) as HomeRun[], standings: (standings || []) as TeamStanding[] };
}

export default async function SprayPage() {
  const { hrs, standings } = await getData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#f5c518]">Spray Chart</h1>
        <p className="text-[#888] text-sm mt-1">Where every dinger landed — color coded by team</p>
      </div>
      <SprayChart homeRuns={hrs} standings={standings} />
    </div>
  );
}
