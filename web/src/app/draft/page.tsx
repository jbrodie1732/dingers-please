import { createClient } from '@supabase/supabase-js';
import DraftBoard from '@/components/DraftBoard';
import type { Team, Player, DraftPick } from '@/lib/types';

export const revalidate = 0;

function serverClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

export default async function DraftPage() {
  const db = serverClient();

  const [{ data: teams }, { data: picks }, { data: players }] = await Promise.all([
    db.from('teams').select('id, name, draft_position, created_at').order('draft_position'),
    db.from('draft_picks')
      .select('*, players(id, name, position, mlb_team), teams(id, name)')
      .eq('season', 2026)
      .order('overall_pick'),
    db.from('players')
      .select('id, name, position, mlb_team, team_id, mlb_player_id, created_at')
      .order('name'),
  ]);

  const totalPicks = (teams?.length ?? 0) * 9;
  const madeCount  = picks?.length ?? 0;

  return (
    <div className="screen">
      <div className="hero-header">
        <div className="hero-eyebrow">2026 SNAKE DRAFT · 9 ROUNDS · {teams?.length ?? 0} TEAMS</div>
        <h1 className="hero-title">Draft Room</h1>
        <div className="hero-meta">
          <span><b>{madeCount}</b> of <b>{totalPicks}</b> picks made</span>
          <span className="dot-sep">·</span>
          <span>Live · realtime updates</span>
        </div>
      </div>

      <DraftBoard
        initialTeams={teams as Team[] ?? []}
        initialPicks={picks as DraftPick[] ?? []}
        initialPlayers={players as Player[] ?? []}
      />
    </div>
  );
}
