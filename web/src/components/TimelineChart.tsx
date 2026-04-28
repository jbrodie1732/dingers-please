'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { DailyTeamHr } from '@/lib/types';
import { getTeamColor } from '@/lib/types';

export type HourlyHR = { hit_at: string; team_id: string };

interface Team { id: string; name: string; color: string }

// ─── Playback ─────────────────────────────────────────────────────────────────
function usePlayback(maxHours: number) {
  const [t, setTState]  = useState(maxHours);
  const [playing, setPl] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef  = useRef<number>();
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    const tick = (now: number) => {
      if (lastRef.current == null) lastRef.current = now;
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      setTState(prev => {
        const next = prev + dt * 12 * speed;
        if (next >= maxHours) { setPl(false); return maxHours; }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = null;
    };
  }, [playing, speed, maxHours]);

  const seek    = useCallback((v: number) => { setPl(false); setTState(v); }, []);
  const play    = useCallback(() => { if (t >= maxHours) setTState(0); setPl(true); }, [t, maxHours]);
  const pause   = useCallback(() => setPl(false), []);
  const restart = useCallback(() => { setTState(0); setPl(true); }, []);

  return { t, setT: seek, playing, play, pause, restart, speed, setSpeed };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function hourToLabel(t: number, startMs: number): string {
  const d = new Date(startMs + t * 3_600_000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
}

// Build cumulative HR counts for all teams up to hour `t`
function cumulativeAt(
  events: { t: number; teamId: string }[],
  teams:  Team[],
  t: number,
): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(teams.map(tm => [tm.id, 0]));
  for (const e of events) {
    if (e.t > t) break;
    if (out[e.teamId] !== undefined) out[e.teamId]++;
  }
  return out;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ModeToggle({ mode, setMode }: { mode: string; setMode: (m: 'static' | 'realtime') => void }) {
  return (
    <div className="mode-toggle">
      <button className={`mode-btn${mode === 'static' ? ' is-on' : ''}`} onClick={() => setMode('static')}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
          <path d="M2 12L6 7l3 2 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Static
      </button>
      <button className={`mode-btn${mode === 'realtime' ? ' is-on' : ''}`} onClick={() => setMode('realtime')}>
        <svg viewBox="0 0 16 16" width="14" height="14">
          <circle cx="8" cy="8" r="3" fill="currentColor"/>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.5"/>
        </svg>
        Real-Time
      </button>
    </div>
  );
}

const W = 900, H = 460, PAD_L = 44, PAD_R = 90, PAD_T = 24, PAD_B = 36;
const IW = W - PAD_L - PAD_R, IH = H - PAD_T - PAD_B;

function GridLines({ niceMax }: { niceMax: number }) {
  return (
    <>
      {[0, 0.25, 0.5, 0.75, 1].map((p) => {
        const y = PAD_T + IH * (1 - p);
        return (
          <g key={p}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y}
              stroke="var(--c-border)" strokeDasharray="2 4"/>
            <text x={PAD_L - 8} y={y + 4} textAnchor="end"
              fill="var(--c-textDim)" fontSize="10" fontFamily="var(--font-mono)">
              {Math.round(niceMax * p)}
            </text>
          </g>
        );
      })}
    </>
  );
}

// ─── Static chart ─────────────────────────────────────────────────────────────
function RaceStaticChart({
  teams, dates, series, niceMax, hover, setHover,
}: {
  teams: Team[]; dates: string[]; series: Record<string, number[]>;
  niceMax: number; hover: string | null; setHover: (id: string | null) => void;
}) {
  const n = dates.length;
  if (n < 2) return null;

  const xAt = (d: number) => PAD_L + (d / (n - 1)) * IW;
  const yAt = (v: number) => PAD_T + IH - (v / niceMax) * IH;

  const sorted = [...teams].sort((a, b) =>
    (series[b.id]?.at(-1) ?? 0) - (series[a.id]?.at(-1) ?? 0)
  );

  return (
    <div className="card card-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg">
        <GridLines niceMax={niceMax} />

        {/* x-axis date labels */}
        {[0, Math.floor(n * 0.25), Math.floor(n * 0.5), Math.floor(n * 0.75), n - 1]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map(d => (
            <text key={d} x={xAt(d)} y={H - PAD_B + 18} textAnchor="middle"
              fill="var(--c-textDim)" fontSize="10" fontFamily="var(--font-mono)">
              {new Date(dates[d] + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </text>
          ))}

        {sorted.map((team, rank) => {
          const pts = series[team.id] ?? [];
          if (pts.length < 2) return null;
          const path = pts.map((v, d) => `${d === 0 ? 'M' : 'L'}${xAt(d)},${yAt(v)}`).join(' ');
          const last = pts[pts.length - 1];
          const isHov = hover === team.id;
          const dimmed = hover !== null && !isHov;
          return (
            <g key={team.id} className="race-line"
              onMouseEnter={() => setHover(team.id)}
              onMouseLeave={() => setHover(null)}>
              <path d={path} fill="none" stroke={team.color}
                strokeWidth={isHov ? 3.2 : rank < 3 ? 2.2 : 1.4}
                strokeLinejoin="round" strokeLinecap="round"
                opacity={dimmed ? 0.15 : 1}/>
              <circle cx={xAt(n - 1)} cy={yAt(last)} r={isHov ? 5 : 3} fill={team.color}
                opacity={dimmed ? 0.15 : 1}/>
              {rank < 3 && (
                <text x={xAt(n - 1) + 8} y={yAt(last) + 4}
                  fill={team.color} fontSize="11" fontFamily="var(--font-mono)" fontWeight="600"
                  opacity={dimmed ? 0.15 : 1}>
                  {team.name.slice(0, 14)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function RaceLegend({
  teams, totals, hover, setHover,
}: {
  teams: Team[]; totals: Record<string, number>;
  hover: string | null; setHover: (id: string | null) => void;
}) {
  const sorted = [...teams].sort((a, b) => (totals[b.id] ?? 0) - (totals[a.id] ?? 0));
  return (
    <div className="race-legend">
      {sorted.map(team => (
        <div
          key={team.id}
          className={`legend-chip${hover !== null && hover !== team.id ? ' is-dim' : ''}`}
          onMouseEnter={() => setHover(team.id)}
          onMouseLeave={() => setHover(null)}
        >
          <span className="legend-dot" style={{ background: team.color }} />
          <span className="legend-name">{team.name}</span>
          <span className="legend-hrs">{totals[team.id] ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Real-Time chart ──────────────────────────────────────────────────────────
function RaceRealtimeChart({
  teams, hourlyEvents, maxHours, niceMax, playback, hover, setHover,
}: {
  teams: Team[]; hourlyEvents: { t: number; teamId: string }[];
  maxHours: number; niceMax: number;
  playback: ReturnType<typeof usePlayback>;
  hover: string | null; setHover: (id: string | null) => void;
}) {
  const xAt = (h: number) => PAD_L + (h / maxHours) * IW;
  const yAt = (v: number) => PAD_T + IH - (v / niceMax) * IH;
  const SAMPLE = 6;

  const { series, currentValues } = useMemo(() => {
    const t = playback.t;
    const cumul: Record<string, number> = Object.fromEntries(teams.map(tm => [tm.id, 0]));
    const pts: Record<string, { t: number; v: number }[]> = Object.fromEntries(teams.map(tm => [tm.id, []]));

    let ei = 0;
    for (let h = 0; h <= t; h += SAMPLE) {
      while (ei < hourlyEvents.length && hourlyEvents[ei].t <= h) {
        if (cumul[hourlyEvents[ei].teamId] !== undefined) cumul[hourlyEvents[ei].teamId]++;
        ei++;
      }
      for (const tm of teams) pts[tm.id].push({ t: h, v: cumul[tm.id] });
    }
    while (ei < hourlyEvents.length && hourlyEvents[ei].t <= t) {
      if (cumul[hourlyEvents[ei].teamId] !== undefined) cumul[hourlyEvents[ei].teamId]++;
      ei++;
    }
    for (const tm of teams) pts[tm.id].push({ t, v: cumul[tm.id] });

    return { series: pts, currentValues: { ...cumul } };
  }, [playback.t, teams, hourlyEvents]);

  const ranked = [...teams]
    .sort((a, b) => (currentValues[b.id] ?? 0) - (currentValues[a.id] ?? 0));

  return (
    <div className="card card-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg">
        <GridLines niceMax={niceMax} />

        {/* Day labels */}
        {[0, Math.floor(maxHours * 0.25), Math.floor(maxHours * 0.5), Math.floor(maxHours * 0.75), maxHours].map(h => (
          <text key={h} x={xAt(h)} y={H - PAD_B + 18} textAnchor="middle"
            fill="var(--c-textDim)" fontSize="10" fontFamily="var(--font-mono)">
            D{Math.floor(h / 24) + 1}
          </text>
        ))}

        {/* Playhead */}
        <line x1={xAt(playback.t)} x2={xAt(playback.t)} y1={PAD_T} y2={PAD_T + IH}
          stroke="var(--c-accent)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6"/>

        {/* Lines */}
        {teams.map((team, rank) => {
          const pts = series[team.id] ?? [];
          if (pts.length < 2) return null;
          const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(p.t)},${yAt(p.v)}`).join(' ');
          const isHov = hover === team.id;
          const dimmed = hover !== null && !isHov;
          return (
            <g key={team.id} className="race-line"
              onMouseEnter={() => setHover(team.id)}
              onMouseLeave={() => setHover(null)}>
              <path d={path} fill="none" stroke={team.color}
                strokeWidth={isHov ? 3.2 : rank < 3 ? 2.2 : 1.4}
                strokeLinejoin="round" strokeLinecap="round"
                opacity={dimmed ? 0.15 : 1}/>
            </g>
          );
        })}

        {/* End-point dots + labels for top 5 */}
        {ranked.slice(0, 5).map((team, rank) => {
          const v = currentValues[team.id] ?? 0;
          const x = xAt(playback.t);
          const y = yAt(v);
          const isHov = hover === team.id;
          return (
            <g key={team.id} opacity={hover !== null && !isHov ? 0.15 : 1}>
              <circle cx={x} cy={y} r={rank < 3 ? 4.5 : 3} fill={team.color}
                stroke="var(--c-bg)" strokeWidth="0.8"/>
              <text x={x + 8} y={y + 4} fill={team.color}
                fontSize={rank < 3 ? 11 : 10} fontFamily="var(--font-mono)" fontWeight="600">
                {team.name.slice(0, 12)} · {v}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Playback bar ─────────────────────────────────────────────────────────────
function PlaybackBar({
  playback, maxHours, startMs,
}: {
  playback: ReturnType<typeof usePlayback>; maxHours: number; startMs: number;
}) {
  const { t, setT, playing, play, pause, restart, speed, setSpeed } = playback;
  const pct = maxHours > 0 ? (t / maxHours) * 100 : 0;

  return (
    <div className="playback-bar">
      <div className="pb-controls">
        <button className="pb-btn" onClick={restart} title="Restart">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M3 3v10M6 8l7-5v10z"/>
          </svg>
        </button>
        {playing ? (
          <button className="pb-btn pb-play" onClick={pause} title="Pause">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <rect x="4" y="3" width="3" height="10"/><rect x="9" y="3" width="3" height="10"/>
            </svg>
          </button>
        ) : (
          <button className="pb-btn pb-play" onClick={play} title="Play">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M4 3l9 5-9 5z"/>
            </svg>
          </button>
        )}
        <div className="pb-speed">
          {([1, 2, 4, 8] as const).map(s => (
            <button key={s} className={`pb-spd${speed === s ? ' is-on' : ''}`}
              onClick={() => setSpeed(s)}>{s}×</button>
          ))}
        </div>
      </div>

      <div className="pb-track-wrap">
        <input
          className="pb-track"
          type="range" min={0} max={maxHours} step={0.5}
          value={t}
          onChange={e => setT(parseFloat(e.target.value))}
          style={{ '--pct': `${pct}%` } as React.CSSProperties}
        />
        <div className="pb-stamp">
          {startMs > 0 ? hourToLabel(t, startMs) : `Hour ${Math.round(t)}`}
        </div>
      </div>
    </div>
  );
}

// ─── RT live leaderboard ──────────────────────────────────────────────────────
function RaceLiveLeaderboard({
  teams, hourlyEvents, playback,
}: {
  teams: Team[]; hourlyEvents: { t: number; teamId: string }[];
  playback: ReturnType<typeof usePlayback>;
}) {
  const current = useMemo(
    () => cumulativeAt(hourlyEvents, teams, playback.t),
    [hourlyEvents, teams, playback.t]
  );
  const prev = useMemo(
    () => cumulativeAt(hourlyEvents, teams, Math.max(0, playback.t - 24)),
    [hourlyEvents, teams, playback.t]
  );

  const ranked    = [...teams].sort((a, b) => (current[b.id] ?? 0) - (current[a.id] ?? 0));
  const prevRanked = [...teams].sort((a, b) => (prev[b.id]    ?? 0) - (prev[a.id]    ?? 0));
  const prevPos: Record<string, number> = {};
  prevRanked.forEach((t, i) => { prevPos[t.id] = i; });

  return (
    <div className="rt-leader">
      <div className="rt-leader-head">LIVE STANDINGS</div>
      <div className="rt-leader-list">
        {ranked.map((team, i) => {
          const movement = (prevPos[team.id] ?? i) - i;
          return (
            <div key={team.id} className="rt-leader-row"
              style={{ '--team': team.color } as React.CSSProperties}>
              <span className="rtl-rank">{i + 1}</span>
              <span className="rtl-dot" style={{ background: team.color }} />
              <span className="rtl-name">{team.name}</span>
              {movement !== 0 && (
                <span className={`rtl-move ${movement > 0 ? 'is-up' : 'is-dn'}`}>
                  {movement > 0 ? '▲' : '▼'}{Math.abs(movement)}
                </span>
              )}
              <span className="rtl-hrs">{current[team.id] ?? 0}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
interface Props {
  dailyData:  DailyTeamHr[];
  hourlyHRs:  HourlyHR[];
}

export default function TimelineChart({ dailyData, hourlyHRs }: Props) {
  const [mode,  setMode]  = useState<'static' | 'realtime'>('static');
  const [hover, setHover] = useState<string | null>(null);

  const teams = useMemo<Team[]>(() => {
    const map = new Map<string, { id: string; name: string; total: number }>();
    for (const r of dailyData) {
      const t = map.get(r.team_id) ?? { id: r.team_id, name: r.team_name, total: 0 };
      t.total += r.daily_hrs;
      map.set(r.team_id, t);
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .map(t => ({ id: t.id, name: t.name, color: getTeamColor(t.id) }));
  }, [dailyData]);

  const { dates, staticSeries, teamTotals } = useMemo(() => {
    const dates = Array.from(new Set(dailyData.map(r => r.game_date))).sort();
    const running: Record<string, number> = {};
    const series:  Record<string, number[]> = {};
    for (const t of teams) { running[t.id] = 0; series[t.id] = []; }
    for (const date of dates) {
      for (const r of dailyData.filter(r => r.game_date === date)) {
        running[r.team_id] = (running[r.team_id] ?? 0) + r.daily_hrs;
      }
      for (const t of teams) series[t.id].push(running[t.id] ?? 0);
    }
    const totals = Object.fromEntries(teams.map(t => [t.id, running[t.id] ?? 0]));
    return { dates, staticSeries: series, teamTotals: totals };
  }, [dailyData, teams]);

  const { hourlyEvents, maxHours, startMs } = useMemo(() => {
    if (!hourlyHRs.length) return { hourlyEvents: [], maxHours: 1, startMs: 0 };
    const startMs  = new Date(hourlyHRs[0].hit_at).getTime();
    const endMs    = Math.max(new Date(hourlyHRs[hourlyHRs.length - 1].hit_at).getTime(), Date.now());
    const maxHours = Math.ceil((endMs - startMs) / 3_600_000);
    const events   = hourlyHRs.map(hr => ({
      t:      (new Date(hr.hit_at).getTime() - startMs) / 3_600_000,
      teamId: hr.team_id,
    }));
    return { hourlyEvents: events, maxHours, startMs };
  }, [hourlyHRs]);

  const playback = usePlayback(maxHours);

  const maxY    = Math.max(...Object.values(teamTotals), 1);
  const niceMax = Math.ceil(maxY / 10) * 10 || 10;

  if (teams.length === 0) {
    return (
      <div className="card" style={{
        padding: '60px 20px', textAlign: 'center',
        fontFamily: 'var(--font-mono)', fontSize: 12,
        letterSpacing: '0.1em', color: 'var(--c-textDim)',
      }}>
        NO DATA YET — CHECK BACK AFTER THE FIRST GAMES
      </div>
    );
  }

  return (
    <>
      <ModeToggle mode={mode} setMode={setMode} />

      {mode === 'static' ? (
        <>
          <RaceStaticChart
            teams={teams} dates={dates} series={staticSeries}
            niceMax={niceMax} hover={hover} setHover={setHover}
          />
          <RaceLegend teams={teams} totals={teamTotals} hover={hover} setHover={setHover} />
        </>
      ) : (
        <>
          <RaceRealtimeChart
            teams={teams} hourlyEvents={hourlyEvents}
            maxHours={maxHours} niceMax={niceMax}
            playback={playback} hover={hover} setHover={setHover}
          />
          <PlaybackBar playback={playback} maxHours={maxHours} startMs={startMs} />
          <RaceLiveLeaderboard teams={teams} hourlyEvents={hourlyEvents} playback={playback} />
        </>
      )}
    </>
  );
}
