// timeline-screens.jsx — Race + H2H with Static / Real-Time toggle, scrubber, play/pause

const { useState: tlS, useEffect: tlE, useMemo: tlM, useRef: tlR, useCallback: tlC } = React;

// Shared playback hook
function usePlayback(maxHours) {
  const [t, setT] = tlS(maxHours); // start at end (full data view)
  const [playing, setPlaying] = tlS(false);
  const [speed, setSpeed] = tlS(1); // hours per real-second multiplier
  const rafRef = tlR();
  const lastRef = tlR();

  tlE(() => {
    if (!playing) return;
    const tick = (now) => {
      if (lastRef.current == null) lastRef.current = now;
      const dt = (now - lastRef.current) / 1000; // seconds
      lastRef.current = now;
      // Speed: 1x = 12 hours/sec → traverse 1080 hours in ~90s
      // 2x = 24 hr/sec → ~45s; 4x = 48 hr/sec → ~22s
      setT(prev => {
        const next = prev + dt * 12 * speed;
        if (next >= maxHours) { setPlaying(false); return maxHours; }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastRef.current = null;
    };
  }, [playing, speed, maxHours]);

  const play = tlC(() => {
    if (t >= maxHours) setT(0);
    setPlaying(true);
  }, [t, maxHours]);
  const pause = tlC(() => setPlaying(false), []);
  const restart = tlC(() => { setT(0); setPlaying(true); }, []);
  const seek = tlC((newT) => { setPlaying(false); setT(newT); }, []);

  return { t, setT: seek, playing, play, pause, restart, speed, setSpeed };
}

// Compute cumulative HRs for each team up to time t, returns 15-length array
function cumulativeAllAt(t) {
  const out = new Array(window.TEAMS.length).fill(0);
  for (const e of window.HOURLY_EVENTS) {
    if (e.t > t) break;
    out[e.teamIdx]++;
  }
  return out;
}

// Get HRs that fired in the last N hours (for flash effect)
function recentEvents(t, windowHours = 8) {
  const out = [];
  for (const e of window.HOURLY_EVENTS) {
    if (e.t > t) break;
    if (e.t > t - windowHours) out.push(e);
  }
  return out;
}

// ─── The Race (with timeline) ─────────────────────────────────────────────────
function RaceScreen({ standings }) {
  const [mode, setMode] = tlS('static'); // 'static' | 'realtime'
  const [hover, setHover] = tlS(null);
  const playback = usePlayback(window.HOURS_TOTAL);

  if (mode === 'static') {
    return (
      <div className="screen screen-race">
        <div className="hero-header">
          <div className="hero-eyebrow">CUMULATIVE HRS · POST-ASB</div>
          <h1 className="hero-title">THE RACE</h1>
          <div className="hero-meta"><span>Day <b>{window.DAYS}</b> of 79</span></div>
        </div>
        <ModeToggle mode={mode} setMode={setMode} />
        <RaceStaticChart hover={hover} setHover={setHover} standings={standings} />
        <RaceLegend hover={hover} setHover={setHover} standings={standings} />
      </div>
    );
  }

  return (
    <div className="screen screen-race">
      <div className="hero-header">
        <div className="hero-eyebrow">CUMULATIVE HRS · POST-ASB</div>
        <h1 className="hero-title">THE RACE</h1>
        <div className="hero-meta"><span>{window.hourToLabel(playback.t)}</span></div>
      </div>
      <ModeToggle mode={mode} setMode={setMode} />
      <RaceRealtimeChart playback={playback} standings={standings} hover={hover} setHover={setHover} />
      <PlaybackBar playback={playback} />
      <RaceLiveLeaderboard playback={playback} standings={standings} />
    </div>
  );
}

function ModeToggle({ mode, setMode }) {
  return (
    <div className="mode-toggle">
      <button className={`mode-btn${mode === 'static' ? ' is-on' : ''}`} onClick={() => setMode('static')}>
        <svg viewBox="0 0 16 16" width="14" height="14"><path d="M2 12 L6 7 L9 9 L14 3" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Static
      </button>
      <button className={`mode-btn${mode === 'realtime' ? ' is-on' : ''}`} onClick={() => setMode('realtime')}>
        <svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="3" fill="currentColor"/><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.5"/></svg>
        Real-Time
      </button>
    </div>
  );
}

function RaceStaticChart({ hover, setHover, standings }) {
  const series = window.DAILY_SERIES;
  const days = window.DAYS;
  const w = 900, h = 460, padL = 44, padR = 24, padT = 24, padB = 36;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const maxY = Math.max(...series.flatMap(s => s.points));
  const niceMax = Math.ceil(maxY / 10) * 10;
  const xAt = (d) => padL + (d / (days - 1)) * innerW;
  const yAt = (v) => padT + innerH - (v / niceMax) * innerH;
  const lines = series.map((s, idx) => {
    const team = window.TEAMS[idx];
    const color = window.TEAM_COLORS[idx];
    const standing = standings.findIndex(t => t.id === team.id) + 1;
    const path = s.points.map((v, d) => `${d === 0 ? 'M' : 'L'}${xAt(d)},${yAt(v)}`).join(' ');
    const last = s.points[s.points.length - 1];
    return { idx, team, color, standing, path, last };
  }).sort((a, b) => a.standing - b.standing);

  return (
    <div className="card card-chart">
      <svg viewBox={`0 0 ${w} ${h}`} className="chart-svg">
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={padT + innerH * (1 - p)} y2={padT + innerH * (1 - p)}
                  stroke="var(--c-border)" strokeDasharray="2 4"/>
            <text x={padL - 8} y={padT + innerH * (1 - p) + 4} textAnchor="end"
                  fill="var(--c-textDim)" fontSize="10" fontFamily="var(--font-mono)">
              {Math.round(niceMax * p)}
            </text>
          </g>
        ))}
        {[0, 10, 20, 30, 40, days - 1].map(d => (
          <text key={d} x={xAt(d)} y={h - padB + 18} textAnchor="middle"
                fill="var(--c-textDim)" fontSize="10" fontFamily="var(--font-mono)">
            D{d + 1}
          </text>
        ))}
        {lines.map(l => (
          <g key={l.idx} className="race-line"
             onMouseEnter={() => setHover(l.idx)} onMouseLeave={() => setHover(null)}>
            <path d={l.path} fill="none" stroke={l.color}
                  strokeWidth={hover === l.idx ? 3.2 : (l.standing <= 3 ? 2.2 : 1.4)}
                  strokeLinejoin="round" strokeLinecap="round"
                  opacity={hover === null || hover === l.idx ? 1 : 0.18}/>
            <circle cx={xAt(days - 1)} cy={yAt(l.last)} r={hover === l.idx ? 5 : 3.2} fill={l.color}/>
            {l.standing <= 3 && (
              <text x={xAt(days - 1) + 8} y={yAt(l.last) + 3.5}
                    fill={l.color} fontSize="11" fontFamily="var(--font-mono)" fontWeight="600">
                {l.team.name.slice(0, 14)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function RaceLegend({ hover, setHover, standings }) {
  return (
    <div className="race-legend">
      {standings.map((t) => (
        <div key={t.id} className={`legend-chip${hover !== null && t.idx !== hover ? ' is-dim' : ''}`}
             onMouseEnter={() => setHover(t.idx)} onMouseLeave={() => setHover(null)}>
          <span className="legend-dot" style={{ background: t.color }} />
          <span className="legend-name">{t.name}</span>
          <span className="legend-hrs">{t.hrs}</span>
        </div>
      ))}
    </div>
  );
}

function RaceRealtimeChart({ playback, standings, hover, setHover }) {
  const w = 900, h = 460, padL = 44, padR = 90, padT = 24, padB = 36;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const maxHours = window.HOURS_TOTAL;

  // Build sampled series for each team up to time t.
  // Sample every 12 hours for smooth lines; densify at the playhead.
  const { series, currentValues, recentBlips } = tlM(() => {
    const t = playback.t;
    const SAMPLE = 6; // hours
    const teams = window.TEAMS.length;
    const cumulative = new Array(teams).fill(0);
    const seriesData = window.TEAMS.map(() => []);

    let evIdx = 0;
    for (let h = 0; h <= t; h += SAMPLE) {
      while (evIdx < window.HOURLY_EVENTS.length && window.HOURLY_EVENTS[evIdx].t <= h) {
        cumulative[window.HOURLY_EVENTS[evIdx].teamIdx]++;
        evIdx++;
      }
      seriesData.forEach((arr, i) => arr.push({ t: h, v: cumulative[i] }));
    }
    // Add final point at exact t
    while (evIdx < window.HOURLY_EVENTS.length && window.HOURLY_EVENTS[evIdx].t <= t) {
      cumulative[window.HOURLY_EVENTS[evIdx].teamIdx]++;
      evIdx++;
    }
    seriesData.forEach((arr, i) => arr.push({ t, v: cumulative[i] }));

    // Recent blips for flash effect (HRs in last 4 hours of game time)
    const blips = [];
    for (let i = window.HOURLY_EVENTS.length - 1; i >= 0; i--) {
      const e = window.HOURLY_EVENTS[i];
      if (e.t > t) continue;
      if (e.t < t - 4) break;
      blips.push({ ...e, age: t - e.t, vAt: cumulative[e.teamIdx] });
    }

    return { series: seriesData, currentValues: cumulative, recentBlips: blips };
  }, [playback.t]);

  // Find a stable max across full timeline so the y-axis doesn't jump
  const niceMax = tlM(() => {
    const finals = window.TEAMS.map(t => t.hrs);
    return Math.ceil(Math.max(...finals) / 10) * 10;
  }, []);

  const xAt = (h) => padL + (h / maxHours) * innerW;
  const yAt = (v) => padT + innerH - (v / niceMax) * innerH;

  // Sort teams by current value to label top 3
  const ranked = currentValues
    .map((v, idx) => ({ idx, v, team: window.TEAMS[idx], color: window.TEAM_COLORS[idx] }))
    .sort((a, b) => b.v - a.v);

  return (
    <div className="card card-chart">
      <svg viewBox={`0 0 ${w} ${h}`} className="chart-svg">
        {/* grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={padT + innerH * (1 - p)} y2={padT + innerH * (1 - p)}
                  stroke="var(--c-border)" strokeDasharray="2 4"/>
            <text x={padL - 8} y={padT + innerH * (1 - p) + 4} textAnchor="end"
                  fill="var(--c-textDim)" fontSize="10" fontFamily="var(--font-mono)">
              {Math.round(niceMax * p)}
            </text>
          </g>
        ))}
        {/* day axis */}
        {[0, 9, 18, 27, 36, 44].map(d => (
          <text key={d} x={xAt(d * 24)} y={h - padB + 18} textAnchor="middle"
                fill="var(--c-textDim)" fontSize="10" fontFamily="var(--font-mono)">
            D{d + 1}
          </text>
        ))}
        {/* playhead */}
        <line x1={xAt(playback.t)} x2={xAt(playback.t)} y1={padT} y2={padT + innerH}
              stroke="var(--c-accent)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6"/>
        {/* lines */}
        {series.map((points, idx) => {
          if (points.length < 2) return null;
          const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(p.t)},${yAt(p.v)}`).join(' ');
          const isHov = hover === idx;
          const team = window.TEAMS[idx];
          const color = window.TEAM_COLORS[idx];
          const standing = ranked.findIndex(r => r.idx === idx) + 1;
          return (
            <g key={idx} className="race-line"
               onMouseEnter={() => setHover(idx)} onMouseLeave={() => setHover(null)}>
              <path d={path} fill="none" stroke={color}
                    strokeWidth={isHov ? 3.2 : (standing <= 3 ? 2.2 : 1.4)}
                    strokeLinejoin="round" strokeLinecap="round"
                    opacity={hover === null || isHov ? 1 : 0.18}/>
            </g>
          );
        })}
        {/* current end-points + flashes */}
        {ranked.map((r, i) => {
          const x = xAt(playback.t);
          const y = yAt(r.v);
          // is this team flashing?
          const flash = recentBlips.find(b => b.teamIdx === r.idx);
          const flashOp = flash ? Math.max(0, 1 - flash.age / 4) : 0;
          return (
            <g key={r.idx} opacity={hover === null || hover === r.idx ? 1 : 0.18}>
              {flash && (
                <>
                  <circle cx={x} cy={y} r={6 + flashOp * 16} fill="none"
                          stroke={r.color} strokeWidth="1.5" opacity={flashOp * 0.7}/>
                  <circle cx={x} cy={y} r={4 + flashOp * 8} fill={r.color} opacity={flashOp * 0.4}/>
                </>
              )}
              <circle cx={x} cy={y} r={i < 3 ? 4.5 : 3.2} fill={r.color}
                      stroke="var(--c-bg)" strokeWidth="0.8"/>
              {i < 5 && (
                <text x={x + 8} y={y + 3.5}
                      fill={r.color} fontSize={i < 3 ? 11 : 10}
                      fontFamily="var(--font-mono)" fontWeight="600">
                  {r.team.name.slice(0, 12)} · {r.v}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function PlaybackBar({ playback, label }) {
  const { t, setT, playing, play, pause, restart, speed, setSpeed } = playback;
  const maxH = window.HOURS_TOTAL;
  const pct = (t / maxH) * 100;
  return (
    <div className="playback-bar">
      <div className="pb-controls">
        <button className="pb-btn" onClick={restart} title="Restart">
          <svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 3v10M6 8l7-5v10z" fill="currentColor"/></svg>
        </button>
        {playing ? (
          <button className="pb-btn pb-play" onClick={pause} title="Pause">
            <svg viewBox="0 0 16 16" width="14" height="14"><rect x="4" y="3" width="3" height="10" fill="currentColor"/><rect x="9" y="3" width="3" height="10" fill="currentColor"/></svg>
          </button>
        ) : (
          <button className="pb-btn pb-play" onClick={play} title="Play">
            <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 3l9 5-9 5z" fill="currentColor"/></svg>
          </button>
        )}
        <div className="pb-speed">
          {[1, 2, 4, 8].map(s => (
            <button key={s} className={`pb-spd${speed === s ? ' is-on' : ''}`} onClick={() => setSpeed(s)}>{s}×</button>
          ))}
        </div>
      </div>
      <div className="pb-track-wrap">
        <input
          className="pb-track"
          type="range" min={0} max={maxH} step={0.5}
          value={t}
          onChange={(e) => setT(parseFloat(e.target.value))}
          style={{ '--pct': pct + '%' }}
        />
        <div className="pb-stamp">{window.hourToLabel(t)}</div>
      </div>
    </div>
  );
}

function RaceLiveLeaderboard({ playback, standings }) {
  const values = tlM(() => cumulativeAllAt(playback.t), [playback.t]);
  const ranked = values
    .map((v, idx) => ({ idx, v, team: window.TEAMS[idx], color: window.TEAM_COLORS[idx] }))
    .sort((a, b) => b.v - a.v);
  // Compare to a moment ago to show movement
  const prev = tlM(() => cumulativeAllAt(Math.max(0, playback.t - 24)), [playback.t]);
  const prevRanked = prev
    .map((v, idx) => ({ idx, v }))
    .sort((a, b) => b.v - a.v);
  const prevPos = {};
  prevRanked.forEach((r, i) => { prevPos[r.idx] = i; });

  return (
    <div className="rt-leader">
      <div className="rt-leader-head">LIVE STANDINGS</div>
      <div className="rt-leader-list">
        {ranked.map((r, i) => {
          const movement = prevPos[r.idx] - i; // + means moved up
          return (
            <div key={r.idx} className="rt-leader-row" style={{ '--team': r.color }}>
              <span className="rtl-rank">{i + 1}</span>
              <span className="rtl-dot" style={{ background: r.color }} />
              <span className="rtl-name">{r.team.name}</span>
              {movement !== 0 && (
                <span className={`rtl-move ${movement > 0 ? 'is-up' : 'is-dn'}`}>
                  {movement > 0 ? '▲' : '▼'}{Math.abs(movement)}
                </span>
              )}
              <span className="rtl-hrs">{r.v}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── H2H (with timeline) ─────────────────────────────────────────────────────
function H2HScreen({ standings }) {
  const [a, setA] = tlS(standings[0]?.id);
  const [b, setB] = tlS(standings[1]?.id);
  const [mode, setMode] = tlS('static');
  const playback = usePlayback(window.HOURS_TOTAL);

  const tA = standings.find(t => t.id === a), tB = standings.find(t => t.id === b);
  if (!tA || !tB) return null;

  return (
    <div className="screen screen-h2h">
      <div className="hero-header">
        <div className="hero-eyebrow">SIDE BY SIDE</div>
        <h1 className="hero-title">HEAD TO HEAD</h1>
      </div>

      <div className="h2h-pickers">
        <select value={a} onChange={e => setA(e.target.value)} className="h2h-select">
          {standings.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <span className="h2h-vs">VS</span>
        <select value={b} onChange={e => setB(e.target.value)} className="h2h-select">
          {standings.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <ModeToggle mode={mode} setMode={setMode} />

      {mode === 'static' ? (
        <H2HStatic tA={tA} tB={tB} />
      ) : (
        <H2HRealtime tA={tA} tB={tB} playback={playback} />
      )}
    </div>
  );
}

function H2HStatic({ tA, tB }) {
  const days = window.DAYS;
  const seriesA = window.DAILY_SERIES[window.TEAMS.findIndex(t => t.id === tA.id)];
  const seriesB = window.DAILY_SERIES[window.TEAMS.findIndex(t => t.id === tB.id)];

  const w = 900, h = 360, padL = 40, padR = 16, padT = 16, padB = 28;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const max = Math.ceil(Math.max(...seriesA.points, ...seriesB.points) / 10) * 10;
  const xAt = d => padL + (d / (days - 1)) * innerW;
  const yAt = v => padT + innerH - (v / max) * innerH;
  const pathA = seriesA.points.map((v, d) => `${d === 0 ? 'M' : 'L'}${xAt(d)},${yAt(v)}`).join(' ');
  const pathB = seriesB.points.map((v, d) => `${d === 0 ? 'M' : 'L'}${xAt(d)},${yAt(v)}`).join(' ');
  const lead = tA.hrs > tB.hrs ? tA : tB.hrs > tA.hrs ? tB : null;

  return (
    <>
      <div className="h2h-cards">
        <div className={`h2h-card${lead?.id === tA.id ? ' is-lead' : ''}`} style={{ '--team': tA.color }}>
          <div className="h2h-card-eyebrow">{tA.owner}</div>
          <div className="h2h-card-name">{tA.name}</div>
          <div className="h2h-card-num" style={{ color: tA.color }}>{tA.hrs}</div>
          <div className="h2h-card-lbl">DINGERS</div>
        </div>
        <div className="h2h-gap">
          <div className="h2h-gap-num">{Math.abs(tA.hrs - tB.hrs)}</div>
          <div className="h2h-gap-lbl">{lead ? `${lead.name} LEADS` : 'TIED'}</div>
        </div>
        <div className={`h2h-card${lead?.id === tB.id ? ' is-lead' : ''}`} style={{ '--team': tB.color }}>
          <div className="h2h-card-eyebrow">{tB.owner}</div>
          <div className="h2h-card-name">{tB.name}</div>
          <div className="h2h-card-num" style={{ color: tB.color }}>{tB.hrs}</div>
          <div className="h2h-card-lbl">DINGERS</div>
        </div>
      </div>
      <div className="card card-chart">
        <svg viewBox={`0 0 ${w} ${h}`} className="chart-svg">
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
            <line key={i} x1={padL} x2={w - padR}
                  y1={padT + innerH * (1 - p)} y2={padT + innerH * (1 - p)}
                  stroke="var(--c-border)" strokeDasharray="2 4"/>
          ))}
          <path d={pathA} fill="none" stroke={tA.color} strokeWidth="2.5"/>
          <path d={pathB} fill="none" stroke={tB.color} strokeWidth="2.5"/>
          <circle cx={xAt(days - 1)} cy={yAt(seriesA.points.at(-1))} r="4" fill={tA.color}/>
          <circle cx={xAt(days - 1)} cy={yAt(seriesB.points.at(-1))} r="4" fill={tB.color}/>
        </svg>
      </div>
    </>
  );
}

function H2HRealtime({ tA, tB, playback }) {
  const idxA = window.TEAMS.findIndex(t => t.id === tA.id);
  const idxB = window.TEAMS.findIndex(t => t.id === tB.id);
  const maxH = window.HOURS_TOTAL;

  const { vA, vB, pathA, pathB, leadHistory, flashes } = tlM(() => {
    const t = playback.t;
    const SAMPLE = 6;
    let cA = 0, cB = 0;
    const ptsA = [], ptsB = [], leadHist = [];

    let evIdx = 0;
    for (let h = 0; h <= t; h += SAMPLE) {
      while (evIdx < window.HOURLY_EVENTS.length && window.HOURLY_EVENTS[evIdx].t <= h) {
        if (window.HOURLY_EVENTS[evIdx].teamIdx === idxA) cA++;
        else if (window.HOURLY_EVENTS[evIdx].teamIdx === idxB) cB++;
        evIdx++;
      }
      ptsA.push({ t: h, v: cA });
      ptsB.push({ t: h, v: cB });
      // lead at this moment: 0 = tied, 1 = A, -1 = B
      leadHist.push({ t: h, lead: cA > cB ? 1 : cB > cA ? -1 : 0, gap: cA - cB });
    }
    while (evIdx < window.HOURLY_EVENTS.length && window.HOURLY_EVENTS[evIdx].t <= t) {
      if (window.HOURLY_EVENTS[evIdx].teamIdx === idxA) cA++;
      else if (window.HOURLY_EVENTS[evIdx].teamIdx === idxB) cB++;
      evIdx++;
    }
    ptsA.push({ t, v: cA });
    ptsB.push({ t, v: cB });
    leadHist.push({ t, lead: cA > cB ? 1 : cB > cA ? -1 : 0, gap: cA - cB });

    // Recent flashes
    const fl = [];
    for (let i = window.HOURLY_EVENTS.length - 1; i >= 0; i--) {
      const e = window.HOURLY_EVENTS[i];
      if (e.t > t) continue;
      if (e.t < t - 4) break;
      if (e.teamIdx === idxA || e.teamIdx === idxB) {
        fl.push({ ...e, age: t - e.t, isA: e.teamIdx === idxA });
      }
    }
    return { vA: cA, vB: cB, pathA: ptsA, pathB: ptsB, leadHistory: leadHist, flashes: fl };
  }, [playback.t, idxA, idxB]);

  const w = 900, h = 360, padL = 40, padR = 90, padT = 16, padB = 28;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const finalMax = Math.max(tA.hrs, tB.hrs);
  const niceMax = Math.ceil(finalMax / 10) * 10;
  const xAt = (hh) => padL + (hh / maxH) * innerW;
  const yAt = (v) => padT + innerH - (v / niceMax) * innerH;

  const dA = pathA.length >= 2 ? pathA.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(p.t)},${yAt(p.v)}`).join(' ') : '';
  const dB = pathB.length >= 2 ? pathB.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(p.t)},${yAt(p.v)}`).join(' ') : '';

  const lead = vA > vB ? tA : vB > vA ? tB : null;

  return (
    <>
      <div className="h2h-cards">
        <div className={`h2h-card${lead?.id === tA.id ? ' is-lead' : ''}`} style={{ '--team': tA.color }}>
          <div className="h2h-card-eyebrow">{tA.owner}</div>
          <div className="h2h-card-name">{tA.name}</div>
          <div className="h2h-card-num" style={{ color: tA.color }}>{vA}</div>
          <div className="h2h-card-lbl">DINGERS</div>
        </div>
        <div className="h2h-gap">
          <div className="h2h-gap-num">{Math.abs(vA - vB)}</div>
          <div className="h2h-gap-lbl">{lead ? `${lead.name} LEADS` : 'TIED'}</div>
        </div>
        <div className={`h2h-card${lead?.id === tB.id ? ' is-lead' : ''}`} style={{ '--team': tB.color }}>
          <div className="h2h-card-eyebrow">{tB.owner}</div>
          <div className="h2h-card-name">{tB.name}</div>
          <div className="h2h-card-num" style={{ color: tB.color }}>{vB}</div>
          <div className="h2h-card-lbl">DINGERS</div>
        </div>
      </div>

      <div className="card card-chart">
        <svg viewBox={`0 0 ${w} ${h}`} className="chart-svg">
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
            <line key={i} x1={padL} x2={w - padR}
                  y1={padT + innerH * (1 - p)} y2={padT + innerH * (1 - p)}
                  stroke="var(--c-border)" strokeDasharray="2 4"/>
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
            <text key={'y' + i} x={padL - 8} y={padT + innerH * (1 - p) + 4} textAnchor="end"
                  fill="var(--c-textDim)" fontSize="10" fontFamily="var(--font-mono)">
              {Math.round(niceMax * p)}
            </text>
          ))}
          {[0, 11, 22, 33, 44].map(d => (
            <text key={d} x={xAt(d * 24)} y={h - padB + 18} textAnchor="middle"
                  fill="var(--c-textDim)" fontSize="10" fontFamily="var(--font-mono)">
              D{d + 1}
            </text>
          ))}
          {/* playhead */}
          <line x1={xAt(playback.t)} x2={xAt(playback.t)} y1={padT} y2={padT + innerH}
                stroke="var(--c-accent)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6"/>
          {/* lines */}
          {dA && <path d={dA} fill="none" stroke={tA.color} strokeWidth="2.5" strokeLinejoin="round"/>}
          {dB && <path d={dB} fill="none" stroke={tB.color} strokeWidth="2.5" strokeLinejoin="round"/>}
          {/* current dots */}
          <circle cx={xAt(playback.t)} cy={yAt(vA)} r="5" fill={tA.color} stroke="var(--c-bg)" strokeWidth="1.2"/>
          <circle cx={xAt(playback.t)} cy={yAt(vB)} r="5" fill={tB.color} stroke="var(--c-bg)" strokeWidth="1.2"/>
          {/* labels */}
          <text x={xAt(playback.t) + 10} y={yAt(vA) + 4} fill={tA.color} fontSize="12" fontWeight="700"
                fontFamily="var(--font-mono)">{tA.name.slice(0, 10)} {vA}</text>
          <text x={xAt(playback.t) + 10} y={yAt(vB) + 4} fill={tB.color} fontSize="12" fontWeight="700"
                fontFamily="var(--font-mono)">{tB.name.slice(0, 10)} {vB}</text>
          {/* flashes */}
          {flashes.map((f, i) => {
            const op = Math.max(0, 1 - f.age / 4);
            const color = f.isA ? tA.color : tB.color;
            const v = f.isA ? vA : vB;
            const x = xAt(playback.t), y = yAt(v);
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={6 + op * 18} fill="none" stroke={color} strokeWidth="1.5" opacity={op * 0.7}/>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Lead-tracker bar */}
      <div className="lead-tracker">
        <div className="lead-tracker-head">
          <div className="lt-label">LEAD TRACKER</div>
          <div className="lt-legend">
            <span style={{ color: tA.color }}>● {tA.name}</span>
            <span style={{ color: tB.color }}>● {tB.name}</span>
          </div>
        </div>
        <svg viewBox={`0 0 ${maxH} 40`} preserveAspectRatio="none" className="lead-tracker-svg">
          {leadHistory.map((seg, i) => {
            if (i === 0) return null;
            const prev = leadHistory[i - 1];
            const x = prev.t, w2 = seg.t - prev.t;
            const color = seg.lead === 1 ? tA.color : seg.lead === -1 ? tB.color : 'var(--c-border)';
            return <rect key={i} x={x} y="0" width={w2} height="40" fill={color}/>;
          })}
          {/* playhead */}
          <line x1={playback.t} x2={playback.t} y1="0" y2="40"
                stroke="var(--c-bone)" strokeWidth="3"/>
        </svg>
        <div className="lt-axis">
          <span>ASB</span>
          <span>Day 15</span>
          <span>Day 30</span>
          <span>Day 45</span>
        </div>
      </div>

      <PlaybackBar playback={playback} />
    </>
  );
}

Object.assign(window, { RaceScreen, H2HScreen, ModeToggle, PlaybackBar, usePlayback });
