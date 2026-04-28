import { createClient } from '@supabase/supabase-js';
import PlayerPool from '@/components/PlayerPool';
import type { PoolPlayer } from '@/components/PlayerPool';

export const revalidate = 0;

function serverClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

export default async function PoolPage() {
  const db = serverClient();

  const [{ data }, { data: hrData }] = await Promise.all([
    db.from('players').select('id, name, position, mlb_team, teams(name)').order('name'),
    db.from('player_standings').select('player_id, total_hrs'),
  ]);

  const hrsByPlayerId: Record<string, number> = {};
  for (const row of (hrData ?? []) as any[]) {
    hrsByPlayerId[row.player_id] = row.total_hrs ?? 0;
  }

  const players: PoolPlayer[] = ((data ?? []) as any[]).map(p => ({
    id:           p.id,
    name:         p.name,
    position:     p.position,
    mlb_team:     p.mlb_team ?? null,
    fantasy_team: p.teams?.name ?? null,
    total_hrs:    hrsByPlayerId[p.id] ?? 0,
  }));

  return (
    <div className="screen">
      <div className="hero-header">
        <div className="hero-eyebrow">{players.length} ELIGIBLE BATTERS</div>
        <h1 className="hero-title">Player Pool</h1>
        <div className="hero-meta">
          <span><b>{players.filter(p => p.fantasy_team).length}</b> drafted</span>
          <span className="dot-sep">·</span>
          <span><b>{players.filter(p => !p.fantasy_team).length}</b> available</span>
        </div>
      </div>

      <PlayerPool players={players} />
    </div>
  );
}
