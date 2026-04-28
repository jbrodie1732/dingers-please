'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { TeamStanding } from '@/lib/types';
import { getTeamColor } from '@/lib/types';

interface Props {
  initialStandings: TeamStanding[];
}

export default function StandingsTable({ initialStandings }: Props) {
  const [standings, setStandings] = useState<TeamStanding[]>(initialStandings);
  const [pulseId, setPulseId]     = useState<string | null>(null);

  const sorted = [...standings].sort((a, b) => b.total_hrs - a.total_hrs);
  const leader = sorted[0];
  const max    = Math.max(...sorted.map(s => s.total_hrs), 1);

  useEffect(() => {
    const channel = supabase
      .channel('standings_hr_insert')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'home_runs' }, async (payload) => {
        const { data } = await supabase
          .from('team_standings')
          .select('*')
          .order('total_hrs', { ascending: false });
        if (data) {
          setStandings(data);
          // find the team whose player just hit and pulse their row
          const { data: playerData } = await supabase
            .from('players')
            .select('team_id')
            .eq('id', payload.new.player_id)
            .single();
          if (playerData?.team_id) {
            setPulseId(playerData.team_id);
            setTimeout(() => setPulseId(null), 2400);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <section className="card card-board">
      <div className="card-head">
        <div className="card-head-l">
          <h2 className="card-title">League Board</h2>
          <span className="card-sub">{sorted.length} teams</span>
        </div>
      </div>

      <div className="board-table">
        {/* header */}
        <div className="board-row board-head">
          <div className="bcol bcol-rank">#</div>
          <div className="bcol bcol-team">TEAM</div>
          <div className="bcol bcol-bar">PACE</div>
          <div className="bcol bcol-num">HR</div>
          <div className="bcol bcol-gap">GB</div>
        </div>

        {sorted.map((t, i) => {
          const color   = getTeamColor(t.team_id);
          const gap     = (leader?.total_hrs ?? 0) - t.total_hrs;
          const pct     = t.total_hrs / max;
          const isLeader = i === 0;
          const isPulse  = pulseId === t.team_id;

          return (
            <div
              key={t.team_id}
              className={[
                'board-row',
                isLeader ? 'is-leader' : '',
                isPulse  ? 'is-pulse'  : '',
              ].join(' ').trim()}
              style={{ '--team': color } as React.CSSProperties}
            >
              <div className="bcol bcol-rank">
                <span className="rank-num">{String(i + 1).padStart(2, '0')}</span>
              </div>

              <div className="bcol bcol-team">
                <span className="team-chip" style={{ background: color, color }} />
                <div className="team-stack">
                  <div className="team-name">{t.team_name}</div>
                </div>
              </div>

              <div className="bcol bcol-bar">
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${pct * 100}%`, background: color, color }}
                  />
                  {isLeader && <div className="bar-leader-tag">LEADER</div>}
                </div>
              </div>

              <div className="bcol bcol-num">
                <span className="num-big">{t.total_hrs}</span>
              </div>

              <div className="bcol bcol-gap">
                {gap === 0
                  ? <span className="gap-leader">—</span>
                  : <span className="gap-num">-{gap}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
