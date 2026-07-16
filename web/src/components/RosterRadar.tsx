'use client';

import { useMemo, useState } from 'react';
import type { AxisModel, RadarModel } from '@/lib/radar';
import { formatMetric, normalize } from '@/lib/radar';

interface Props {
  model: RadarModel;
  teamName: string;
  color: string;
}

// ─── geometry ───────────────────────────────────────────────────────────────
const SIZE = 360;               // drawing area (square)
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 118;                  // outer ring radius
const RINGS = 4;                // number of concentric grid rings
// Horizontal/vertical padding baked into the viewBox so axis labels (which sit
// outside R) never clip against the card edge — matters most on narrow mobile.
const PAD_X = 36;               // just enough that the widest labels don't clip
const PAD_Y = 14;
const LABEL_OFFSET = 24;        // how far past the rim the labels sit

// Axis i sits at this angle (degrees), starting at the top and going clockwise.
function axisAngle(i: number, n: number): number {
  return -90 + (i * 360) / n;
}

function point(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
}

function polygonPoints(norms: number[]): string {
  const n = norms.length;
  return norms
    .map((t, i) => {
      const { x, y } = point(CX, CY, R * t, axisAngle(i, n));
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

export default function RosterRadar({ model, teamName, color }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const team = model.teams[teamName];
  const axes = model.axes;
  const n = axes.length;

  const teamNorms = useMemo(
    () => axes.map(a => normalize(team?.averages[a.key] ?? null, a.min, a.max)),
    [axes, team]
  );
  const leagueNorms = useMemo(() => axes.map(a => a.leagueNorm), [axes]);

  if (!team) return null;

  const coverageIncomplete = team.coverage.withStats < team.coverage.total;

  return (
    <div className="radar-wrap">
      <div className="radar-chart">
        <svg viewBox={`${-PAD_X} ${-PAD_Y} ${SIZE + 2 * PAD_X} ${SIZE + 2 * PAD_Y}`}
             className="radar-svg" role="img"
             aria-label={`Average batted-ball profile for ${teamName}`}>
          <defs>
            <radialGradient id="radar-team-fill" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor={color} stopOpacity="0.38" />
              <stop offset="100%" stopColor={color} stopOpacity="0.12" />
            </radialGradient>
          </defs>

          {/* concentric grid rings */}
          {Array.from({ length: RINGS }, (_, r) => {
            const t = (r + 1) / RINGS;
            const pts = polygonPoints(Array(n).fill(t));
            return (
              <polygon key={r} points={pts} fill="none"
                       stroke="var(--c-border)" strokeWidth={0.8}
                       opacity={r === RINGS - 1 ? 0.9 : 0.45} />
            );
          })}

          {/* spokes + axis labels */}
          {axes.map((a, i) => {
            const outer = point(CX, CY, R, axisAngle(i, n));
            const lbl = point(CX, CY, R + LABEL_OFFSET, axisAngle(i, n));
            const cos = Math.cos((axisAngle(i, n) * Math.PI) / 180);
            const anchor = cos > 0.15 ? 'start' : cos < -0.15 ? 'end' : 'middle';
            const isHot = hover === i;
            const teamRaw = team.averages[a.key];
            return (
              <g key={a.key}>
                <line x1={CX} y1={CY} x2={outer.x} y2={outer.y}
                      stroke="var(--c-border)" strokeWidth={0.8} opacity={0.6} />
                <text x={lbl.x} y={lbl.y - 4} textAnchor={anchor}
                      className={`radar-axis-label${isHot ? ' is-hot' : ''}`}>
                  {a.label}
                </text>
                <text x={lbl.x} y={lbl.y + 8} textAnchor={anchor}
                      className={`radar-axis-value${isHot ? ' is-hot' : ''}`}
                      style={isHot ? { fill: color } : undefined}>
                  {formatMetric(teamRaw, a.fmt)}
                </text>
              </g>
            );
          })}

          {/* league-average reference polygon */}
          <polygon points={polygonPoints(leagueNorms)}
                   fill="none" stroke="var(--c-textDim)" strokeWidth={1.2}
                   strokeDasharray="3 3" opacity={0.7} />

          {/* selected team polygon */}
          <polygon points={polygonPoints(teamNorms)}
                   fill="url(#radar-team-fill)" stroke={color} strokeWidth={2}
                   strokeLinejoin="round" />

          {/* team vertices (hover targets) */}
          {teamNorms.map((t, i) => {
            const p = point(CX, CY, R * t, axisAngle(i, n));
            const isHot = hover === i;
            return (
              <circle key={i} cx={p.x} cy={p.y} r={isHot ? 5.5 : 3.5}
                      fill={color} stroke="var(--c-bg)" strokeWidth={1.5}
                      style={{ filter: isHot ? `drop-shadow(0 0 6px ${color})` : 'none', cursor: 'pointer' }}
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)} />
            );
          })}
        </svg>
      </div>

      <div className="radar-side">
        <div className="radar-legend">
          <div className="radar-legend-row">
            <span className="radar-swatch" style={{ background: color }} />
            <span className="radar-legend-name" style={{ color }}>{teamName}</span>
          </div>
          <div className="radar-legend-row">
            <span className="radar-swatch is-league" />
            <span className="radar-legend-name">League avg</span>
          </div>
        </div>

        <div className="radar-readout">
          {axes.map((a, i) => (
            <RadarStatRow
              key={a.key}
              axis={a}
              teamValue={team.averages[a.key]}
              color={color}
              hot={hover === i}
              onHover={(on) => setHover(on ? i : null)}
            />
          ))}
        </div>

        <p className="radar-foot">
          Each axis scaled independently across all {Object.keys(model.teams).length} rosters ·
          rim = league&apos;s best, center = league&apos;s worst.
          {coverageIncomplete && (
            <> {' '}<span className="radar-warn">
              Averaging {team.coverage.withStats}/{team.coverage.total} players with stats.
            </span></>
          )}
        </p>
      </div>
    </div>
  );
}

function RadarStatRow({
  axis, teamValue, color, hot, onHover,
}: {
  axis: AxisModel;
  teamValue: number | null;
  color: string;
  hot: boolean;
  onHover: (on: boolean) => void;
}) {
  const t = normalize(teamValue, axis.min, axis.max);
  const vsLeague =
    teamValue != null && axis.leagueValue != null
      ? teamValue - axis.leagueValue
      : null;
  const above = vsLeague != null && vsLeague >= 0;

  return (
    <div className={`radar-stat${hot ? ' is-hot' : ''}`}
         onMouseEnter={() => onHover(true)}
         onMouseLeave={() => onHover(false)}>
      <div className="radar-stat-head">
        <span className="radar-stat-label">{axis.label}</span>
        <span className="radar-stat-val">{formatMetric(teamValue, axis.fmt)}</span>
      </div>
      <div className="radar-stat-bar">
        <div className="radar-stat-fill" style={{ width: `${(t * 100).toFixed(1)}%`, background: color }} />
        <div className="radar-stat-league" style={{ left: `${(axis.leagueNorm * 100).toFixed(1)}%` }} />
      </div>
      {vsLeague != null && (
        <span className={`radar-stat-delta ${above ? 'is-up' : 'is-down'}`}>
          {above ? '▲' : '▼'} {formatMetric(Math.abs(vsLeague), axis.fmt)} vs avg
        </span>
      )}
    </div>
  );
}
