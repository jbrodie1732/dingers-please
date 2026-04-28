'use client';

import { useMemo, useState } from 'react';
import type { HomeRun, TeamStanding } from '@/lib/types';
import { getTeamColor } from '@/lib/types';

function toFieldCoords(spray_x: number, spray_y: number) {
  const cx = 60  + ((spray_x - 20) / 210) * 480;
  const cy = 140 + ((spray_y - 10) / 220) * 285;
  return { cx, cy };
}

function BigField({
  hrs,
  onSelect,
  selected,
}: {
  hrs: HomeRun[];
  onSelect: (hr: HomeRun | null) => void;
  selected: HomeRun | null;
}) {
  return (
    <svg viewBox="0 0 600 480" className="bigfield">
      <defs>
        <linearGradient id="grass-big" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor="var(--c-diamond)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--c-diamond)" stopOpacity="0.04" />
        </linearGradient>
        <pattern id="halftone-field" patternUnits="userSpaceOnUse" width="6" height="6">
          <circle cx="3" cy="3" r="0.6" fill="var(--c-borderHi)" opacity="0.4" />
        </pattern>
      </defs>
      {/* fair territory */}
      <path d="M 300 440 L 60 140 Q 300 -20 540 140 Z"
            fill="url(#grass-big)" stroke="var(--c-borderHi)" strokeWidth="1" />
      <path d="M 300 440 L 60 140 Q 300 -20 540 140 Z"
            fill="url(#halftone-field)" opacity="0.25" />
      {/* foul lines */}
      <line x1="300" y1="440" x2="60"  y2="140" stroke="var(--c-foul)" strokeOpacity="0.45" strokeWidth="1.2" />
      <line x1="300" y1="440" x2="540" y2="140" stroke="var(--c-foul)" strokeOpacity="0.45" strokeWidth="1.2" />
      {/* warning track */}
      <path d="M 80 150 Q 300 -10 520 150" fill="none" stroke="var(--c-borderHi)" strokeWidth="0.8" strokeDasharray="3 4" />
      {/* infield diamond */}
      <polygon points="300,400 250,350 300,300 350,350" fill="none" stroke="var(--c-borderHi)" strokeWidth="1" />
      <circle cx="300" cy="350" r="6" fill="var(--c-borderHi)" />
      <circle cx="300" cy="425" r="3" fill="var(--c-bone)" />
      {/* HR dots */}
      {hrs.map(hr => {
        if (hr.spray_x == null || hr.spray_y == null) return null;
        const { cx, cy } = toFieldCoords(hr.spray_x, hr.spray_y);
        const isSel  = selected?.id === hr.id;
        const teamId = (hr.players as any)?.team_id ?? '';
        const color  = teamId ? getTeamColor(teamId) : '#888';
        return (
          <g key={hr.id} onClick={() => onSelect(isSel ? null : hr)} style={{ cursor: 'pointer' }}>
            {isSel && (
              <line x1="300" y1="425" x2={cx} y2={cy}
                    stroke={color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7" />
            )}
            <circle
              cx={cx} cy={cy}
              r={isSel ? 9 : 5}
              fill={color}
              stroke={isSel ? 'var(--c-bone)' : 'var(--c-bg)'}
              strokeWidth={isSel ? 2 : 1}
              style={{ filter: isSel ? `drop-shadow(0 0 10px ${color})` : 'none' }}
            />
          </g>
        );
      })}
    </svg>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-cell">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function MickeyDetail({ hr }: { hr: HomeRun }) {
  const count  = hr.mickey_meter_count ?? 0;
  const label  = hr.mickey_meter_label ?? '';
  const ok     = label === 'LEGIT';
  const angle  = (count / 30) * 180;
  const arcLen = (count / 30) * 226;
  const teamId = (hr.players as any)?.team_id ?? '';
  const color  = teamId ? getTeamColor(teamId) : '#888';

  return (
    <div className="mickey-detail">
      <div className="md-name">{hr.players?.name ?? '—'}</div>
      <div className="md-team" style={{ color }}>{hr.players?.teams?.name ?? '—'}</div>
      <div className="mickey-dial">
        <svg viewBox="0 0 200 165" width="100%">
          <defs>
            <linearGradient id="dial-grad" x1="0" x2="1">
              <stop offset="0%"   stopColor="var(--c-mickey)" />
              <stop offset="60%"  stopColor="var(--c-accent)" />
              <stop offset="100%" stopColor="var(--c-legit)"  />
            </linearGradient>
          </defs>
          {/* track */}
          <path d="M 28 110 A 72 72 0 0 1 172 110"
                fill="none" stroke="var(--c-border)" strokeWidth="14" strokeLinecap="round" />
          {/* fill */}
          <path d="M 28 110 A 72 72 0 0 1 172 110"
                fill="none" stroke="url(#dial-grad)" strokeWidth="14" strokeLinecap="round"
                strokeDasharray={`${arcLen} 999`} />
          {/* needle */}
          <g transform={`translate(100 110) rotate(${-180 + angle})`}>
            <line x1="0" y1="0" x2="64" y2="0" stroke="var(--c-bone)" strokeWidth="2.5" strokeLinecap="round" />
            <circle r="6" fill="var(--c-bone)" />
            <circle r="3" fill="var(--c-bg)" />
          </g>
          {/* tick labels */}
          {[0, 10, 20, 30].map(t => {
            const a  = (t / 30) * 180;
            const ax = 100 + Math.cos((180 - a) * Math.PI / 180) * 84;
            const ay = 110 - Math.sin((180 - a) * Math.PI / 180) * 84;
            return (
              <text key={t} x={ax} y={ay + 4} textAnchor="middle" fontSize="8"
                    fill="var(--c-textDim)" fontFamily="var(--font-mono)">{t}</text>
            );
          })}
          {/* readout */}
          <text x="100" y="134" textAnchor="middle" fontSize="40" fontWeight="900"
                fill="var(--c-bone)" fontFamily="var(--font-digital)">{count}</text>
          <text x="100" y="147" textAnchor="middle" fontSize="8" letterSpacing="1"
                fill="var(--c-textDim)" fontFamily="var(--font-mono)">/ 30 PARKS</text>
          <text x="100" y="161" textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="1.5"
                fill={ok ? 'var(--c-legit)' : 'var(--c-mickey)'} fontFamily="var(--font-mono)">
            {ok ? 'LEGIT' : 'MICKEY MOUSE'}
          </text>
        </svg>
      </div>
      <div className="md-stats">
        <StatCell label="DIST" value={hr.distance     != null ? `${hr.distance} ft`     : '—'} />
        <StatCell label="EV"   value={hr.launch_speed  != null ? `${hr.launch_speed} mph` : '—'} />
        <StatCell label="LA"   value={hr.launch_angle  != null ? `${hr.launch_angle}°`   : '—'} />
        <StatCell label="DATE" value={hr.game_date ?? '—'} />
      </div>
    </div>
  );
}

interface Props {
  homeRuns:  HomeRun[];
  standings: TeamStanding[];
}

export default function SprayChart({ homeRuns, standings }: Props) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedHR,     setSelectedHR]     = useState<HomeRun | null>(null);

  const filtered = useMemo(() => {
    const base = homeRuns.filter(hr => hr.spray_x != null && hr.spray_y != null);
    if (!selectedTeamId) return base;
    return base.filter(hr => (hr.players as any)?.team_id === selectedTeamId);
  }, [homeRuns, selectedTeamId]);

  function handleChip(teamId: string | null) {
    setSelectedTeamId(teamId);
    setSelectedHR(null);
  }

  return (
    <>
      <div className="spray-controls">
        <button
          className={`chip${selectedTeamId === null ? ' is-on' : ''}`}
          style={selectedTeamId === null ? { background: 'var(--c-accent)', borderColor: 'var(--c-accent)' } : {}}
          onClick={() => handleChip(null)}
        >
          All teams
        </button>
        {standings.map(t => {
          const color = getTeamColor(t.team_id);
          const isOn  = selectedTeamId === t.team_id;
          return (
            <button
              key={t.team_id}
              className={`chip${isOn ? ' is-on' : ''}`}
              style={isOn
                ? { background: color, borderColor: color }
                : ({ '--team': color } as React.CSSProperties)}
              onClick={() => handleChip(t.team_id)}
            >
              <span className="chip-dot" style={{ background: color }} />
              {t.team_name}
            </button>
          );
        })}
      </div>

      <div className="spray-grid">
        <div className="card card-field">
          <div className="card-head">
            <h2 className="card-title">{filtered.length} dingers</h2>
          </div>
          <div className="field-wrap">
            <BigField hrs={filtered} onSelect={setSelectedHR} selected={selectedHR} />
          </div>
        </div>

        <div className="card card-mickey">
          <div className="card-head"><h2 className="card-title">Mickey Meter</h2></div>
          {selectedHR ? (
            <MickeyDetail hr={selectedHR} />
          ) : (
            <div className="mickey-empty">
              <div className="mickey-empty-eyebrow">SELECT A HOME RUN</div>
              <p className="mickey-empty-body">
                The Mickey Meter scores how many of MLB&apos;s 30 ballparks a home run would have cleared,
                using distance, exit velocity, and launch angle.
              </p>
              <div className="legend-pair">
                <div className="legend-row"><span className="dot is-legit" /><b>LEGIT</b> · 18+ parks</div>
                <div className="legend-row"><span className="dot is-mouse" /><b>MICKEY MOUSE</b> · &lt; 18 parks</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
