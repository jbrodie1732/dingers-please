'use client';

import { useMemo, useState } from 'react';
import type { HomeRun, TeamStanding, MickeyTone } from '@/lib/types';
import { getTeamColor, mickeyTier } from '@/lib/types';

const MICKEY_TONE_VAR: Record<MickeyTone, string> = {
  clubhouse: 'var(--c-foul)',
  mickey:    'var(--c-mickey)',
  kinda:     'var(--c-accent)',
  legit:     'var(--c-legit)',
};

function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  if (!m) return String(iso);
  return `${m}/${d}/${y.slice(2)}`;
}

// Statcast/Gameday hit coordinates use home plate ≈ (125.42, 198.27) with the
// outfield in the -y direction, ~2.495 ft per unit — the exact convention the
// watcher's Mickey Meter already relies on (src/watcher/mickeyMouse.js).
//
// The old mapping rescaled x and y by DIFFERENT factors (x by 480/210 ≈ 2.29,
// y by 285/220 ≈ 1.30), which stretched the field horizontally ~1.76× and
// distorted every ball's angle off home plate — a ball pulled ~45° down the
// line got skewed to ~60° and rendered in foul territory (e.g. Trea Turner's
// pull). The fix is a single home-plate-anchored affine transform with an
// EQUAL x/y scale, so true spray angles are preserved and the drawn ±45° foul
// lines line up with the data.
const GC_HOME_X = 125.42;   // home plate, Gameday x
const GC_HOME_Y = 198.27;   // home plate, Gameday y
const SVG_HOME_X = 300;     // home plate in SVG space
const SVG_HOME_Y = 430;
const SVG_SCALE = 1.6;      // SVG px per Gameday coordinate unit

function toFieldCoords(spray_x: number, spray_y: number) {
  const dx = (spray_x - GC_HOME_X) * SVG_SCALE;        // + = toward right field
  const dy = (GC_HOME_Y - spray_y) * SVG_SCALE;        // + = toward the outfield
  return { cx: SVG_HOME_X + dx, cy: SVG_HOME_Y - dy };
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
      {/* fair territory — foul lines at a true ±45° off home plate (300,430),
          so the drawn fan matches the coordinate transform above */}
      <path d="M 300 430 L 151 281 Q 300 55 449 281 Z"
            fill="url(#grass-big)" stroke="var(--c-borderHi)" strokeWidth="1" />
      <path d="M 300 430 L 151 281 Q 300 55 449 281 Z"
            fill="url(#halftone-field)" opacity="0.25" />
      {/* foul lines */}
      <line x1="300" y1="430" x2="151" y2="281" stroke="var(--c-foul)" strokeOpacity="0.45" strokeWidth="1.2" />
      <line x1="300" y1="430" x2="449" y2="281" stroke="var(--c-foul)" strokeOpacity="0.45" strokeWidth="1.2" />
      {/* warning track */}
      <path d="M 168 278 Q 300 82 432 278" fill="none" stroke="var(--c-borderHi)" strokeWidth="0.8" strokeDasharray="3 4" />
      {/* infield diamond */}
      <polygon points="300,430 341,389 300,348 259,389" fill="none" stroke="var(--c-borderHi)" strokeWidth="1" />
      <circle cx="300" cy="391" r="6" fill="var(--c-borderHi)" />
      <circle cx="300" cy="430" r="3" fill="var(--c-bone)" />
      {/* HR dots */}
      {hrs.map(hr => {
        if (hr.spray_x == null || hr.spray_y == null) return null;
        const { cx, cy } = toFieldCoords(hr.spray_x, hr.spray_y);
        const isSel  = selected?.id === hr.id;
        const teamId = (hr.players as any)?.team_id ?? '';
        const draftPosition = (hr.players as any)?.teams?.draft_position ?? null;
        const color  = teamId ? getTeamColor(teamId, draftPosition) : '#888';
        return (
          <g key={hr.id} onClick={() => onSelect(isSel ? null : hr)} style={{ cursor: 'pointer' }}>
            {isSel && (
              <line x1="300" y1="430" x2={cx} y2={cy}
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
  const tier   = mickeyTier(hr.mickey_meter_count);
  const toneColor = MICKEY_TONE_VAR[tier.tone];
  const angle  = (count / 30) * 180;
  const arcLen = (count / 30) * 226;
  const teamId = (hr.players as any)?.team_id ?? '';
  const draftPosition = (hr.players as any)?.teams?.draft_position ?? null;
  const color  = teamId ? getTeamColor(teamId, draftPosition) : '#888';

  return (
    <div className="mickey-detail">
      <div className="md-name">{hr.players?.name ?? '—'}</div>
      <div className="md-team" style={{ color }}>{hr.players?.teams?.name ?? '—'}</div>
      <div className="mickey-dial">
        <svg viewBox="0 0 200 190" width="100%">
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
          {/* needle — pivots at the arc center (100,110), clear above the readout */}
          <g transform={`translate(100 110) rotate(${-180 + angle})`}>
            <line x1="0" y1="0" x2="60" y2="0" stroke="var(--c-bone)" strokeWidth="2.5" strokeLinecap="round" />
            <circle r="5.5" fill="var(--c-bone)" />
            <circle r="2.5" fill="var(--c-bg)" />
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
          {/* readout — dropped below the needle pivot so they no longer collide */}
          <text x="100" y="152" textAnchor="middle" fontSize="32" fontWeight="900"
                fill="var(--c-bone)" fontFamily="var(--font-digital)">{count}</text>
          <text x="100" y="165" textAnchor="middle" fontSize="8" letterSpacing="1"
                fill="var(--c-textDim)" fontFamily="var(--font-mono)">/ 30 PARKS</text>
          <text x="100" y="182" textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="0.5"
                fill={toneColor} fontFamily="var(--font-mono)">
            {tier.label}
          </text>
        </svg>
      </div>
      <div className="md-stats">
        <StatCell label="DIST" value={hr.distance     != null ? `${hr.distance} ft`     : '—'} />
        <StatCell label="EV"   value={hr.launch_speed  != null ? `${hr.launch_speed} mph` : '—'} />
        <StatCell label="LA"   value={hr.launch_angle  != null ? `${hr.launch_angle}°`   : '—'} />
        <StatCell label="DATE" value={shortDate(hr.game_date)} />
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
          const color = getTeamColor(t.team_id, t.draft_position);
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
                <div className="legend-row"><span className="dot" style={{ background: 'var(--c-legit)' }} /><b>okay kinda legit</b> · 24–30 parks</div>
                <div className="legend-row"><span className="dot" style={{ background: 'var(--c-accent)' }} /><b>kinda mickey mouse</b> · 20–23 parks</div>
                <div className="legend-row"><span className="dot" style={{ background: 'var(--c-mickey)' }} /><b>mickey mouse</b> · 10–19 parks</div>
                <div className="legend-row"><span className="dot" style={{ background: 'var(--c-foul)' }} /><b>the whole fuckin clubhouse</b> · &lt; 10 parks</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
