'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { DailyTeamHr, TeamStanding } from '@/lib/types';
import { getTeamColor } from '@/lib/types';
import type { HourlyHR } from './TimelineChart';

interface Team { id: string; name: string; color: string; total: number }

// ─── Playback (local copy — same logic as TimelineChart) ──────────────────────
function usePlayback(maxHours: number) {
  const [t, setTState]   = useState(maxHours);
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

function hourToLabel(t: number, startMs: number): string {
  const d = new Date(startMs + t * 3_600_000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
}

// ─── SVG constants ────────────────────────────────────────────────────────────
const W = 900, H = 360, PL = 40, PR = 90, PT = 16, PB = 28;
const IW = W - PL - PR, IH = H - PT - PB;

// ─── Mode toggle ──────────────────────────────────────────────────────────────
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

// ─── Score cards ──────────────────────────────────────────────────────────────
function ScoreCards({ tA, tB, vA, vB }: { tA: Team; tB: Team; vA: number; vB: number }) {
  const lead = vA > vB ? tA : vB > vA ? tB : null;
  return (
    <div className="h2h-cards">
      <div className={`h2h-card${lead?.id === tA.id ? ' is-lead' : ''}`}
        style={{ '--team': tA.color } as React.CSSProperties}>
        <div className="h2h-card-eyebrow">TEAM</div>
        <div className="h2h-card-name">{tA.name}</div>
        <div className="h2h-card-num" style={{ color: tA.color }}>{vA}</div>
        <div className="h2h-card-lbl">DINGERS</div>
      </div>

      <div className="h2h-gap">
        <div className="h2h-gap-num">{Math.abs(vA - vB)}</div>
        <div className="h2h-gap-lbl">{lead ? `${lead.name.split(' ')[0]} LEADS` : 'TIED'}</div>
      </div>

      <div className={`h2h-card${lead?.id === tB.id ? ' is-lead' : ''}`}
        style={{ '--team': tB.color } as React.CSSProperties}>
        <div className="h2h-card-eyebrow">TEAM</div>
        <div className="h2h-card-name">{tB.name}</div>
        <div className="h2h-card-num" style={{ color: tB.color }}>{vB}</div>
        <div className="h2h-card-lbl">DINGERS</div>
      </div>
    </div>
  );
}

// ─── Static chart ─────────────────────────────────────────────────────────────
function H2HStaticChart({
  tA, tB, dates, seriesA, seriesB,
}: {
  tA: Team; tB: Team; dates: string[]; seriesA: number[]; seriesB: number[];
}) {
  const n = dates.length;
  if (n < 2) return null;

  const maxY    = Math.max(...seriesA, ...seriesB, 1);
  const niceMax = Math.ceil(maxY / 10) * 10 || 10;
  const xAt = (d: number) => PL + (d / (n - 1)) * IW;
  const yAt = (v: number) => PT + IH - (v / niceMax) * IH;

  const pathA = seriesA.map((v, d) => `${d === 0 ? 'M' : 'L'}${xAt(d)},${yAt(v)}`).join(' ');
  const pathB = seriesB.map((v, d) => `${d === 0 ? 'M' : 'L'}${xAt(d)},${yAt(v)}`).join(' ');

  // Shaded area between the two lines (leader's color at ~8% opacity)
  const finalA = seriesA[seriesA.length - 1] ?? 0;
  const finalB = seriesB[seriesB.length - 1] ?? 0;
  const leadColor = finalA >= finalB ? tA.color : tB.color;
  const areaFwd = seriesA.map((v, d) => `${d === 0 ? 'M' : 'L'}${xAt(d)},${yAt(v)}`).join(' ');
  const areaBwd = [...seriesB].reverse().map((v, d) =>
    `L${xAt(n - 1 - d)},${yAt(v)}`
  ).join(' ');
  const areaPath = `${areaFwd} ${areaBwd} Z`;

  return (
    <div className="card card-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg">
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(p => {
          const y = PT + IH * (1 - p);
          return (
            <g key={p}>
              <line x1={PL} x2={W - PR} y1={y} y2={y} stroke="var(--c-border)" strokeDasharray="2 4"/>
              <text x={PL - 8} y={y + 4} textAnchor="end"
                fill="var(--c-textDim)" fontSize="10" fontFamily="var(--font-mono)">
                {Math.round(niceMax * p)}
              </text>
            </g>
          );
        })}

        {/* Date labels */}
        {[0, Math.floor(n * 0.25), Math.floor(n * 0.5), Math.floor(n * 0.75), n - 1]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map(d => (
            <text key={d} x={xAt(d)} y={H - PB + 18} textAnchor="middle"
              fill="var(--c-textDim)" fontSize="10" fontFamily="var(--font-mono)">
              {new Date(dates[d] + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </text>
          ))}

        {/* Shaded area */}
        <path d={areaPath} fill={leadColor} opacity="0.08"/>

        {/* Lines */}
        <path d={pathA} fill="none" stroke={tA.color} strokeWidth="2.5" strokeLinejoin="round"/>
        <path d={pathB} fill="none" stroke={tB.color} strokeWidth="2.5" strokeLinejoin="round"/>

        {/* End dots */}
        <circle cx={xAt(n - 1)} cy={yAt(seriesA[n - 1] ?? 0)} r="4.5" fill={tA.color} stroke="var(--c-bg)" strokeWidth="1.2"/>
        <circle cx={xAt(n - 1)} cy={yAt(seriesB[n - 1] ?? 0)} r="4.5" fill={tB.color} stroke="var(--c-bg)" strokeWidth="1.2"/>
      </svg>
    </div>
  );
}

// ─── Real-Time chart ──────────────────────────────────────────────────────────
function H2HRealtimeChart({
  tA, tB, hourlyHRs, maxHours, playback, startMs,
}: {
  tA: Team; tB: Team; hourlyHRs: HourlyHR[];
  maxHours: number; playback: ReturnType<typeof usePlayback>; startMs: number;
}) {
  const SAMPLE = 6;

  const { ptsA, ptsB, vA, vB, leadHistory } = useMemo(() => {
    const t = playback.t;
    let cA = 0, cB = 0;
    const pA: { t: number; v: number }[] = [];
    const pB: { t: number; v: number }[] = [];
    const lead: { t: number; lead: 1 | -1 | 0 }[] = [];

    const events = hourlyHRs.map(hr => ({
      t:  (new Date(hr.hit_at).getTime() - startMs) / 3_600_000,
      id: hr.team_id,
    }));

    let ei = 0;
    for (let h = 0; h <= t; h += SAMPLE) {
      while (ei < events.length && events[ei].t <= h) {
        if (events[ei].id === tA.id) cA++;
        else if (events[ei].id === tB.id) cB++;
        ei++;
      }
      pA.push({ t: h, v: cA });
      pB.push({ t: h, v: cB });
      lead.push({ t: h, lead: cA > cB ? 1 : cB > cA ? -1 : 0 });
    }
    while (ei < events.length && events[ei].t <= t) {
      if (events[ei].id === tA.id) cA++;
      else if (events[ei].id === tB.id) cB++;
      ei++;
    }
    pA.push({ t, v: cA });
    pB.push({ t, v: cB });
    lead.push({ t, lead: cA > cB ? 1 : cB > cA ? -1 : 0 });

    return { ptsA: pA, ptsB: pB, vA: cA, vB: cB, leadHistory: lead };
  }, [playback.t, tA.id, tB.id, hourlyHRs, startMs]);

  const niceMax = Math.ceil(Math.max(tA.total, tB.total, 1) / 10) * 10 || 10;
  const xAt = (h: number) => PL + (h / maxHours) * IW;
  const yAt = (v: number) => PT + IH - (v / niceMax) * IH;

  const dA = ptsA.length >= 2
    ? ptsA.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(p.t)},${yAt(p.v)}`).join(' ') : '';
  const dB = ptsB.length >= 2
    ? ptsB.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(p.t)},${yAt(p.v)}`).join(' ') : '';

  const leadColor = vA > vB ? tA.color : vB > vA ? tB.color : 'var(--c-textDim)';

  return (
    <>
      <div className="card card-chart">
        <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg">
          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map(p => {
            const y = PT + IH * (1 - p);
            return (
              <g key={p}>
                <line x1={PL} x2={W - PR} y1={y} y2={y} stroke="var(--c-border)" strokeDasharray="2 4"/>
                <text x={PL - 8} y={y + 4} textAnchor="end"
                  fill="var(--c-textDim)" fontSize="10" fontFamily="var(--font-mono)">
                  {Math.round(niceMax * p)}
                </text>
              </g>
            );
          })}

          {/* Day labels */}
          {[0, Math.floor(maxHours * 0.25), Math.floor(maxHours * 0.5), Math.floor(maxHours * 0.75), maxHours].map(h => (
            <text key={h} x={xAt(h)} y={H - PB + 18} textAnchor="middle"
              fill="var(--c-textDim)" fontSize="10" fontFamily="var(--font-mono)">
              D{Math.floor(h / 24) + 1}
            </text>
          ))}

          {/* Playhead */}
          <line x1={xAt(playback.t)} x2={xAt(playback.t)} y1={PT} y2={PT + IH}
            stroke="var(--c-accent)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6"/>

          {/* Shaded area up to playhead */}
          {ptsA.length >= 2 && ptsB.length >= 2 && (() => {
            const fwd = ptsA.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(p.t)},${yAt(p.v)}`).join(' ');
            const bwd = [...ptsB].reverse().map(p => `L${xAt(p.t)},${yAt(p.v)}`).join(' ');
            return <path d={`${fwd} ${bwd} Z`} fill={leadColor} opacity="0.08"/>;
          })()}

          {/* Lines */}
          {dA && <path d={dA} fill="none" stroke={tA.color} strokeWidth="2.5" strokeLinejoin="round"/>}
          {dB && <path d={dB} fill="none" stroke={tB.color} strokeWidth="2.5" strokeLinejoin="round"/>}

          {/* Current end-point dots + labels */}
          <circle cx={xAt(playback.t)} cy={yAt(vA)} r="5" fill={tA.color} stroke="var(--c-bg)" strokeWidth="1.2"/>
          <circle cx={xAt(playback.t)} cy={yAt(vB)} r="5" fill={tB.color} stroke="var(--c-bg)" strokeWidth="1.2"/>
          <text x={xAt(playback.t) + 10} y={yAt(vA) + 4}
            fill={tA.color} fontSize="12" fontWeight="700" fontFamily="var(--font-mono)">
            {tA.name.slice(0, 10)} · {vA}
          </text>
          <text x={xAt(playback.t) + 10} y={yAt(vB) + 4}
            fill={tB.color} fontSize="12" fontWeight="700" fontFamily="var(--font-mono)">
            {tB.name.slice(0, 10)} · {vB}
          </text>
        </svg>
      </div>

      {/* Lead tracker */}
      <div className="lead-tracker">
        <div className="lead-tracker-head">
          <div className="lt-label">LEAD TRACKER</div>
          <div className="lt-legend">
            <span style={{ color: tA.color }}>● {tA.name}</span>
            <span style={{ color: tB.color }}>● {tB.name}</span>
          </div>
        </div>
        <svg viewBox={`0 0 ${maxHours} 40`} preserveAspectRatio="none" className="lead-tracker-svg">
          {leadHistory.map((seg, i) => {
            if (i === 0) return null;
            const prev = leadHistory[i - 1];
            const x = prev.t;
            const w = seg.t - prev.t;
            const fill = seg.lead === 1 ? tA.color : seg.lead === -1 ? tB.color : 'var(--c-border)';
            return <rect key={i} x={x} y="0" width={w} height="40" fill={fill} opacity={seg.lead !== 0 ? 0.7 : 1}/>;
          })}
          <line x1={playback.t} x2={playback.t} y1="0" y2="40"
            stroke="var(--c-bone)" strokeWidth="3"/>
        </svg>
        <div className="lt-axis">
          <span>START</span>
          <span>D{Math.floor(maxHours * 0.25 / 24) + 1}</span>
          <span>D{Math.floor(maxHours * 0.5  / 24) + 1}</span>
          <span>D{Math.floor(maxHours * 0.75 / 24) + 1}</span>
          <span>TODAY</span>
        </div>
      </div>
    </>
  );
}

// ─── Playback bar (reused shape) ──────────────────────────────────────────────
function PlaybackBar({ playback, maxHours, startMs }: {
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
          <button className="pb-btn pb-play" onClick={pause}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <rect x="4" y="3" width="3" height="10"/><rect x="9" y="3" width="3" height="10"/>
            </svg>
          </button>
        ) : (
          <button className="pb-btn pb-play" onClick={play}>
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
        <input className="pb-track" type="range" min={0} max={maxHours} step={0.5}
          value={t} onChange={e => setT(parseFloat(e.target.value))}
          style={{ '--pct': `${pct}%` } as React.CSSProperties}/>
        <div className="pb-stamp">
          {startMs > 0 ? hourToLabel(t, startMs) : `Hour ${Math.round(t)}`}
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
interface Props {
  daily:     DailyTeamHr[];
  standings: TeamStanding[];
  hourlyHRs: HourlyHR[];
}

export default function HeadToHead({ daily, standings, hourlyHRs }: Props) {
  const teams = useMemo<Team[]>(() =>
    standings.map(s => ({
      id:    s.team_id,
      name:  s.team_name,
      color: getTeamColor(s.team_id),
      total: s.total_hrs,
    }))
  , [standings]);

  const [teamAId, setTeamAId] = useState<string>(teams[0]?.id ?? '');
  const [teamBId, setTeamBId] = useState<string>(teams[1]?.id ?? '');
  const [mode, setMode]       = useState<'static' | 'realtime'>('static');

  const tA = teams.find(t => t.id === teamAId) ?? teams[0];
  const tB = teams.find(t => t.id === teamBId) ?? teams[1];

  // Static cumsum for selected teams
  const { dates, seriesA, seriesB } = useMemo(() => {
    const dates = Array.from(new Set(daily.map(r => r.game_date))).sort();
    let rA = 0, rB = 0;
    const sA: number[] = [], sB: number[] = [];
    for (const date of dates) {
      const rows = daily.filter(r => r.game_date === date);
      rA += rows.find(r => r.team_id === tA?.id)?.daily_hrs ?? 0;
      rB += rows.find(r => r.team_id === tB?.id)?.daily_hrs ?? 0;
      sA.push(rA);
      sB.push(rB);
    }
    return { dates, seriesA: sA, seriesB: sB };
  }, [daily, tA?.id, tB?.id]);

  // Real-time setup
  const { maxHours, startMs } = useMemo(() => {
    if (!hourlyHRs.length) return { maxHours: 1, startMs: 0 };
    const startMs  = new Date(hourlyHRs[0].hit_at).getTime();
    const endMs    = Math.max(new Date(hourlyHRs[hourlyHRs.length - 1].hit_at).getTime(), Date.now());
    return { maxHours: Math.ceil((endMs - startMs) / 3_600_000), startMs };
  }, [hourlyHRs]);

  const playback = usePlayback(maxHours);

  if (!tA || !tB) return null;

  const vA = seriesA[seriesA.length - 1] ?? 0;
  const vB = seriesB[seriesB.length - 1] ?? 0;

  return (
    <>
      {/* Team pickers */}
      <div className="h2h-pickers">
        <select className="h2h-select" value={teamAId}
          onChange={e => setTeamAId(e.target.value)}>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <span className="h2h-vs">VS</span>
        <select className="h2h-select" value={teamBId}
          onChange={e => setTeamBId(e.target.value)}>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* Score cards */}
      <ScoreCards tA={tA} tB={tB}
        vA={mode === 'static' ? vA : tA.total}
        vB={mode === 'static' ? vB : tB.total}/>

      <ModeToggle mode={mode} setMode={setMode}/>

      {mode === 'static' ? (
        <H2HStaticChart tA={tA} tB={tB} dates={dates} seriesA={seriesA} seriesB={seriesB}/>
      ) : (
        <>
          <H2HRealtimeChart tA={tA} tB={tB} hourlyHRs={hourlyHRs}
            maxHours={maxHours} playback={playback} startMs={startMs}/>
          <PlaybackBar playback={playback} maxHours={maxHours} startMs={startMs}/>
        </>
      )}
    </>
  );
}
