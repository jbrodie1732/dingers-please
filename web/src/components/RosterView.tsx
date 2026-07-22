'use client';

import { useMemo, useState } from 'react';
import type { PlayerStanding, TeamStanding } from '@/lib/types';
import { getTeamColor } from '@/lib/types';
import { buildRadarModel } from '@/lib/radar';
import RosterRadar from './RosterRadar';

const POSITION_ORDER = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

interface Props {
  players:   PlayerStanding[];
  standings: TeamStanding[];
  mlbIdByUuid: Record<string, number | null>;
}

export default function RosterView({ players, standings, mlbIdByUuid }: Props) {
  const [selectedId, setSelectedId] = useState<string>(standings[0]?.team_id ?? '');

  const team  = standings.find(t => t.team_id === selectedId) ?? standings[0];
  const color = team ? getTeamColor(team.team_id, team.draft_position) : 'var(--c-accent)';
  const total = team?.total_hrs ?? 0;

  // Radar = current squad only; a dropped player shouldn't skew the profile.
  const radarModel = useMemo(
    () => buildRadarModel(
      players
        .filter(p => !p.is_dropped)
        .map(p => ({ player_id: p.player_id, team_name: p.team_name })),
      mlbIdByUuid
    ),
    [players, mlbIdByUuid]
  );

  const byPosition = (a: PlayerStanding, b: PlayerStanding) =>
    POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position);

  const teamPlayers    = players.filter(p => p.team_name === team?.team_name);
  const activePlayers  = teamPlayers.filter(p => !p.is_dropped).sort(byPosition);
  const droppedPlayers = teamPlayers.filter(p =>  p.is_dropped).sort(byPosition);

  return (
    <>
      <div className="roster-tabs">
        {standings.map((t, i) => {
          const c   = getTeamColor(t.team_id, t.draft_position);
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

      {team && radarModel.teams[team.team_name] && (
        <div className="radar-card" style={{ '--team': color } as React.CSSProperties}>
          <div className="radar-head">
            <div>
              <div className="radar-eyebrow">BATTED-BALL PROFILE</div>
              <div className="radar-title">{team.team_name} · Post Draft Squad Profile</div>
            </div>
          </div>
          <RosterRadar model={radarModel} teamName={team.team_name} color={color} />
        </div>
      )}

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
            {activePlayers.length === 0 ? (
              <div style={{ gridColumn: '1/-1', padding: '40px', textAlign: 'center', color: 'var(--c-textDim)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em' }}>
                NO PLAYERS ON THIS ROSTER YET
              </div>
            ) : activePlayers.map(p => {
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

          {droppedPlayers.length > 0 && (
            <div className="roster-dropped">
              <div className="roster-dropped-head">
                DROPPED · HRs before the drop still count for {team.team_name}
              </div>
              <div className="roster-dropped-list">
                {droppedPlayers.map(p => (
                  <div key={p.player_id} className="roster-dropped-row">
                    <span className="roster-dropped-pos">{p.position}</span>
                    <span className="roster-dropped-name">{p.player_name}</span>
                    <span className="roster-dropped-hrs">{p.total_hrs} HR</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
