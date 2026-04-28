'use client';

import { useState } from 'react';
import type { PlayerStanding, TeamStanding } from '@/lib/types';
import { getTeamColor } from '@/lib/types';

const POSITION_ORDER = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

interface Props {
  players:   PlayerStanding[];
  standings: TeamStanding[];
}

export default function RosterView({ players, standings }: Props) {
  const [selectedId, setSelectedId] = useState<string>(standings[0]?.team_id ?? '');

  const team  = standings.find(t => t.team_id === selectedId) ?? standings[0];
  const color = team ? getTeamColor(team.team_id) : 'var(--c-accent)';
  const total = team?.total_hrs ?? 0;

  const teamPlayers = players
    .filter(p => p.team_name === team?.team_name)
    .sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position));

  return (
    <>
      <div className="roster-tabs">
        {standings.map((t, i) => {
          const c   = getTeamColor(t.team_id);
          const isOn = t.team_id === selectedId;
          return (
            <button
              key={t.team_id}
              className={`rtab${isOn ? ' is-on' : ''}`}
              style={isOn ? { background: c, borderColor: c } : {}}
              onClick={() => setSelectedId(t.team_id)}
            >
              <span className="rtab-rank">{i + 1}</span>
              <span className="rtab-name">{t.team_name}</span>
              <span className="rtab-hrs">{t.total_hrs}</span>
            </button>
          );
        })}
      </div>

      {team && (
        <div className="roster-card" style={{ '--team': color } as React.CSSProperties}>
          <div className="roster-head">
            <div>
              <div className="roster-eyebrow">FANTASY TEAM</div>
              <div className="roster-name">{team.team_name}</div>
            </div>
            <div className="roster-total">
              <div className="roster-total-num">{total}</div>
              <div className="roster-total-lbl">SEASON HRS</div>
            </div>
          </div>

          <div className="roster-grid">
            {teamPlayers.length === 0 ? (
              <div style={{ gridColumn: '1/-1', padding: '40px', textAlign: 'center', color: 'var(--c-textDim)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em' }}>
                NO PLAYERS ON THIS ROSTER YET
              </div>
            ) : teamPlayers.map(p => {
              const pct = total > 0 ? Math.round((p.total_hrs / total) * 100) : 0;
              return (
                <div key={p.player_id} className="rcard">
                  <div className="rcard-pos">{p.position}</div>
                  <div className="rcard-name">{p.player_name}</div>
                  <div className="rcard-mlb">{p.avg_distance != null ? `avg ${p.avg_distance} ft` : '—'}</div>
                  <div className="rcard-hrs">
                    <span className="rcard-hrs-num">{p.total_hrs}</span>
                    <span className="rcard-hrs-lbl">HR</span>
                  </div>
                  <div className="rcard-bar">
                    <div className="rcard-bar-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <div className="rcard-pct">{pct}% of team</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
