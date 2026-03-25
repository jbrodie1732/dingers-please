import { createClient } from '@supabase/supabase-js';
import PlayerPool from '@/components/PlayerPool';

export const revalidate = 0;

function serverClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

export default async function PoolPage() {
  const db = serverClient();

  const { data } = await db
    .from('players')
    .select('id, name, position, mlb_team, teams(name)')
    .order('name');

  const players = (data ?? []).map((p: any) => ({
    id:           p.id,
    name:         p.name,
    position:     p.position,
    mlb_team:     p.mlb_team ?? null,
    fantasy_team: p.teams?.name ?? null,
  }));

  return (
    <main className="max-w-5xl mx-auto px-4">
      <PlayerPool players={players} />
    </main>
  );
}
