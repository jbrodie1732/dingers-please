import { createClient } from '@supabase/supabase-js';
import DraftBoard from '@/components/DraftBoard';
import type { Team, Player, DraftPick } from '@/lib/types';

export const revalidate = 0; // always SSR fresh

function serverClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

export default async function DraftPage() {
  const db = serverClient();

  const [
    { data: teams },
    { data: picks },
    { data: players },
  ] = await Promise.all([
    db.from('teams').select('id, name, draft_position, created_at').order('draft_position'),
    db.from('draft_picks')
      .select('*, players(id, name, position), teams(id, name)')
      .eq('season', 2026)
      .order('overall_pick'),
    db.from('players')
      .select('id, name, position, team_id, mlb_player_id, created_at')
      .order('name'),
  ]);

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold text-[#f5c518]">🎯 2026 Draft Board</h1>
      <DraftBoard
        initialTeams={teams as Team[] ?? []}
        initialPicks={picks as DraftPick[] ?? []}
        initialPlayers={players as Player[] ?? []}
      />
    </main>
  );
}
