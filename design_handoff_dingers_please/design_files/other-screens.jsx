// other-screens.jsx — Race, Spray, Rosters, H2H, Pool

const { useState: uS, useMemo: uM, useEffect: uE, useRef: uR } = React;

// ─── The Race (timeline) ─────────────────────────────────────────────────────
function RaceScreen({ standings }) {
  const [hover, setHover] = uS(null);
  const series = window.DAILY_SERIES;
  const days = window.DAYS;

  const w = 900, h = 460, padL = 44, padR = 24, padT = 24, padB = 36;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const maxY = Math.max(...series.flatMap(s => s.points));
  const niceMax = Math.ceil(maxY / 10) * 10;

  const xAt = (d) => padL + (d / (days - 1)) * innerW;
  const yAt = (v) => padT + innerH - (v / niceMax) * innerH;

  const lines = series
    .map((s, idx) => {
      const team = window.TEAMS[idx];
      const color = window.TEAM_COLORS[idx];
      const standing = standings.findIndex(t => t.id === team.id) + 1;
      const path = s.points.map((v, d) => `${d === 0 ? 'M' : 'L'}${xAt(d)},${yAt(v)}`).join(' ');
      const last = s.points[s.points.length - 1];
      return { idx, team, color, standing, path, last };
    })
    .sort((a, b) => a.standing - b.standing);

  return (
    <div className="screen screen-race">
      <div className="hero-header">
        <div className="hero-eyebrow">CUMULATIVE HRS · POST-ASB</div>
        <h1 className="hero-title">THE RACE</h1>
        <div className="hero-meta"><span>Day <b>{days}</b> of 79</span></div>
      </div>

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
          {[0, 10, 20, 30, 40, days - 1].map(d => (
            <text key={d} x={xAt(d)} y={h - padB + 18} textAnchor="middle"
                  fill="var(--c-textDim)" fontSize="10" fontFamily="var(--font-mono)">
              D{d + 1}
            </text>
          ))}
          {/* lines */}
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
    </div>
  );
}

// ─── Spray Chart + Mickey Meter showcase ─────────────────────────────────────
function SprayScreen({ hrFeed, standings }) {
  const [filter, setFilter] = uS('All');
  const [selected, setSelected] = uS(null);
  const filtered = filter === 'All' ? hrFeed : hrFeed.filter(h => h.team.id === filter);

  return (
    <div className="screen screen-spray">
      <div className="hero-header">
        <div className="hero-eyebrow">SPRAY CHART · 15 LEAGUE TEAMS</div>
        <h1 className="hero-title">WHERE IT LANDED</h1>
      </div>

      <div className="spray-controls">
        <button className={`chip${filter === 'All' ? ' is-on' : ''}`} onClick={() => setFilter('All')}>All teams</button>
        {standings.map(t => (
          <button key={t.id} className={`chip${filter === t.id ? ' is-on' : ''}`}
                  style={filter === t.id ? { background: t.color, color: '#000', borderColor: t.color } : { '--team': t.color }}
                  onClick={() => setFilter(t.id)}>
            <span className="chip-dot" style={{ background: t.color }} />
            {t.name}
          </button>
        ))}
      </div>

      <div className="spray-grid">
        <div className="card card-field">
          <div className="card-head"><h2 className="card-title">{filtered.length} dingers</h2></div>
          <div className="field-wrap">
            <BigField hrs={filtered} onSelect={setSelected} selected={selected} />
          </div>
        </div>

        <div className="card card-mickey">
          <div className="card-head"><h2 className="card-title">Mickey Meter</h2></div>
          {selected ? (
            <MickeyDetail hr={selected} />
          ) : (
            <div className="mickey-empty">
              <div className="mickey-empty-eyebrow">SELECT A HOME RUN</div>
              <p className="mickey-empty-body">
                The Mickey Meter scores how many of MLB's 30 ballparks a home run would have cleared,
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
    </div>
  );
}

function BigField({ hrs, onSelect, selected }) {
  const w = 600, h = 480;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="bigfield">
      <defs>
        <linearGradient id="grass-big" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--c-diamond)" stopOpacity="0.32"/>
          <stop offset="100%" stopColor="var(--c-diamond)" stopOpacity="0.04"/>
        </linearGradient>
        <pattern id="halftone" patternUnits="userSpaceOnUse" width="6" height="6">
          <circle cx="3" cy="3" r="0.6" fill="var(--c-borderHi)" opacity="0.4"/>
        </pattern>
      </defs>
      {/* fair territory */}
      <path d="M 300 440 L 60 140 Q 300 -20 540 140 Z" fill="url(#grass-big)" stroke="var(--c-borderHi)" strokeWidth="1"/>
      <path d="M 300 440 L 60 140 Q 300 -20 540 140 Z" fill="url(#halftone)" opacity="0.25"/>
      {/* foul lines */}
      <line x1="300" y1="440" x2="60" y2="140" stroke="var(--c-foul)" strokeOpacity="0.45" strokeWidth="1.2"/>
      <line x1="300" y1="440" x2="540" y2="140" stroke="var(--c-foul)" strokeOpacity="0.45" strokeWidth="1.2"/>
      {/* warning track arc */}
      <path d="M 80 150 Q 300 -10 520 150" fill="none" stroke="var(--c-borderHi)" strokeWidth="0.8" strokeDasharray="3 4"/>
      {/* infield diamond */}
      <polygon points="300,400 250,350 300,300 350,350" fill="none" stroke="var(--c-borderHi)" strokeWidth="1"/>
      <circle cx="300" cy="350" r="6" fill="var(--c-borderHi)"/>
      <circle cx="300" cy="425" r="3" fill="var(--c-bone)"/>
      {/* dots */}
      {hrs.map(hr => {
        const cx = 60 + hr.spray.x * 480;
        const cy = 140 + hr.spray.y * 220;
        const isSel = selected && selected.id === hr.id;
        return (
          <g key={hr.id} onClick={() => onSelect(hr)} style={{ cursor: 'pointer' }}>
            <circle cx={cx} cy={cy} r={isSel ? 9 : 5} fill={hr.teamColor}
                    stroke={isSel ? 'var(--c-bone)' : 'var(--c-bg)'} strokeWidth={isSel ? 2 : 1}
                    style={{ filter: isSel ? `drop-shadow(0 0 10px ${hr.teamColor})` : 'none' }}/>
            {isSel && (
              <line x1="300" y1="425" x2={cx} y2={cy} stroke={hr.teamColor} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function MickeyDetail({ hr }) {
  const ok = hr.mickeyLabel === 'LEGIT';
  const angle = (hr.mickeyMeter / 30) * 180; // 0..180 deg on a half-dial
  const r = 72;
  return (
    <div className="mickey-detail">
      <div className="md-name">{hr.player.name}</div>
      <div className="md-team" style={{ color: hr.teamColor }}>{hr.team.name}</div>
      <div className="mickey-dial">
        <svg viewBox="0 0 200 130" width="100%">
          {/* arc */}
          <defs>
            <linearGradient id="dial-grad" x1="0" x2="1">
              <stop offset="0%"  stopColor="var(--c-mickey)"/>
              <stop offset="60%" stopColor="var(--c-accent)"/>
              <stop offset="100%" stopColor="var(--c-legit)"/>
            </linearGradient>
          </defs>
          <path d="M 28 110 A 72 72 0 0 1 172 110" fill="none" stroke="var(--c-border)" strokeWidth="14" strokeLinecap="round"/>
          <path d="M 28 110 A 72 72 0 0 1 172 110" fill="none" stroke="url(#dial-grad)" strokeWidth="14" strokeLinecap="round"
                strokeDasharray={`${(hr.mickeyMeter / 30) * 226} 999`}/>
          {/* needle */}
          <g transform={`translate(100 110) rotate(${-180 + angle})`}>
            <line x1="0" y1="0" x2="64" y2="0" stroke="var(--c-bone)" strokeWidth="2.5" strokeLinecap="round"/>
            <circle r="6" fill="var(--c-bone)"/>
            <circle r="3" fill="var(--c-bg)"/>
          </g>
          {/* tick marks */}
          {[0, 5, 10, 15, 20, 25, 30].map(t => {
            const a = (t / 30) * 180;
            const ax = 100 + Math.cos((180 - a) * Math.PI / 180) * 84;
            const ay = 110 - Math.sin((180 - a) * Math.PI / 180) * 84;
            return <text key={t} x={ax} y={ay + 4} textAnchor="middle" fontSize="8"
                         fill="var(--c-textDim)" fontFamily="var(--font-mono)">{t}</text>;
          })}
        </svg>
        <div className="dial-readout">
          <div className="dial-num">{hr.mickeyMeter}</div>
          <div className="dial-of">/ 30 PARKS</div>
          <div className={`dial-verdict ${ok ? 'is-legit' : 'is-mouse'}`}>
            {ok ? 'LEGIT' : 'MICKEY MOUSE'}
          </div>
        </div>
      </div>
      <div className="md-stats">
        <Stat label="DIST" value={`${hr.distance} ft`} />
        <Stat label="EV"   value={`${hr.exitVelo} mph`} />
        <Stat label="LA"   value={`${hr.launchAngle}°`} />
        <Stat label="INN"  value={hr.inning} />
      </div>
    </div>
  );
}

// ─── Rosters ─────────────────────────────────────────────────────────────────
function RostersScreen({ standings }) {
  const [sel, setSel] = uS(standings[0]?.id);
  const team = standings.find(t => t.id === sel) || standings[0];
  const teamIdx = window.TEAMS.findIndex(t => t.id === team.id);
  const roster = window.TEAM_ROSTERS[teamIdx];
  const players = window.POSITIONS.map(pos => ({ pos, p: roster[pos] })).filter(x => x.p);
  const total = team.hrs;

  return (
    <div className="screen screen-rosters">
      <div className="hero-header">
        <div className="hero-eyebrow">9 STARTERS · ONE PER POSITION</div>
        <h1 className="hero-title">ROSTERS</h1>
      </div>

      <div className="roster-tabs">
        {standings.map((t, i) => (
          <button key={t.id} className={`rtab${sel === t.id ? ' is-on' : ''}`}
                  style={sel === t.id ? { background: t.color, color: '#000', borderColor: t.color } : {}}
                  onClick={() => setSel(t.id)}>
            <span className="rtab-rank">{i + 1}</span>
            <span className="rtab-name">{t.name}</span>
            <span className="rtab-hrs">{t.hrs}</span>
          </button>
        ))}
      </div>

      <div className="roster-card" style={{ '--team': team.color }}>
        <div className="roster-head">
          <div>
            <div className="roster-eyebrow">{team.owner}</div>
            <div className="roster-name">{team.name}</div>
          </div>
          <div className="roster-total">
            <div className="roster-total-num">{team.hrs}</div>
            <div className="roster-total-lbl">SEASON HRS</div>
          </div>
        </div>
        <div className="roster-grid">
          {players.map(({ pos, p }) => {
            const pct = total > 0 ? Math.round((p.hrs / total) * 100) : 0;
            return (
              <div key={pos} className="rcard">
                <div className="rcard-pos">{pos}</div>
                <div className="rcard-name">{p.name}</div>
                <div className="rcard-mlb">{p.mlb}</div>
                <div className="rcard-hrs"><span className="rcard-hrs-num">{p.hrs}</span><span className="rcard-hrs-lbl">HR</span></div>
                <div className="rcard-bar"><div className="rcard-bar-fill" style={{ width: pct + '%', background: team.color }} /></div>
                <div className="rcard-pct">{pct}% of team</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── H2H ─────────────────────────────────────────────────────────────────────
function H2HScreen({ standings }) {
  const [a, setA] = uS(standings[0]?.id);
  const [b, setB] = uS(standings[1]?.id);
  const tA = standings.find(t => t.id === a), tB = standings.find(t => t.id === b);
  const days = window.DAYS;
  const seriesA = window.DAILY_SERIES[window.TEAMS.findIndex(t => t.id === a)];
  const seriesB = window.DAILY_SERIES[window.TEAMS.findIndex(t => t.id === b)];

  const w = 900, h = 360, padL = 40, padR = 16, padT = 16, padB = 28;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const max = Math.ceil(Math.max(...seriesA.points, ...seriesB.points) / 10) * 10;
  const xAt = d => padL + (d / (days - 1)) * innerW;
  const yAt = v => padT + innerH - (v / max) * innerH;
  const pathA = seriesA.points.map((v, d) => `${d === 0 ? 'M' : 'L'}${xAt(d)},${yAt(v)}`).join(' ');
  const pathB = seriesB.points.map((v, d) => `${d === 0 ? 'M' : 'L'}${xAt(d)},${yAt(v)}`).join(' ');
  const lead = tA.hrs > tB.hrs ? tA : tB.hrs > tA.hrs ? tB : null;

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
    </div>
  );
}

// ─── Player Pool ─────────────────────────────────────────────────────────────
function PoolScreen({ draftPicks }) {
  const [search, setSearch] = uS('');
  const [pos, setPos] = uS('ALL');
  const [status, setStatus] = uS('all');

  const filtered = uM(() => {
    return window.PLAYERS.filter(p => {
      if (pos !== 'ALL' && p.pos !== pos) return false;
      if (status === 'available' && p.fantasy_team) return false;
      if (status === 'drafted' && !p.fantasy_team) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [search, pos, status, draftPicks.length]);

  return (
    <div className="screen screen-pool">
      <div className="hero-header">
        <div className="hero-eyebrow">{window.PLAYERS.length} ELIGIBLE BATTERS</div>
        <h1 className="hero-title">PLAYER POOL</h1>
      </div>

      <div className="pool-controls">
        <input className="pool-search" placeholder="Search batter…"
               value={search} onChange={e => setSearch(e.target.value)}/>
        <div className="seg">
          {['all', 'available', 'drafted'].map(s => (
            <button key={s} className={`seg-btn${status === s ? ' is-on' : ''}`} onClick={() => setStatus(s)}>{s}</button>
          ))}
        </div>
        <div className="pos-filters">
          {['ALL', ...window.POSITIONS].map(p => (
            <button key={p} className={`posbtn${pos === p ? ' is-on' : ''}`} onClick={() => setPos(p)}>{p}</button>
          ))}
        </div>
      </div>

      <div className="card pool-table">
        <div className="ptbl-row ptbl-head">
          <div className="ptbl-c c-name">PLAYER</div>
          <div className="ptbl-c c-pos">POS</div>
          <div className="ptbl-c c-mlb">MLB</div>
          <div className="ptbl-c c-tier">TIER</div>
          <div className="ptbl-c c-hrs">HRS</div>
          <div className="ptbl-c c-squad">SQUAD</div>
        </div>
        {filtered.slice(0, 200).map(p => (
          <div key={p.id} className={`ptbl-row${p.fantasy_team ? ' is-drafted' : ''}`}>
            <div className="ptbl-c c-name">{p.name}</div>
            <div className="ptbl-c c-pos"><span className="pos-tag">{p.pos}</span></div>
            <div className="ptbl-c c-mlb">{p.mlb}</div>
            <div className="ptbl-c c-tier"><TierDots tier={p.tier} /></div>
            <div className="ptbl-c c-hrs">{p.hrs || '—'}</div>
            <div className="ptbl-c c-squad">
              {p.fantasy_team
                ? <span className="squad-on">{p.fantasy_team}</span>
                : <span className="squad-off">undrafted</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TierDots({ tier }) {
  return (
    <span className="tier-dots">
      {[1,2,3,4,5].map(i => <span key={i} className={`tdot${i <= (6 - tier) ? ' is-on' : ''}`} />)}
    </span>
  );
}

// Note: RaceScreen + H2HScreen are overridden by timeline-screens.jsx (loaded after this file)
Object.assign(window, { SprayScreen, RostersScreen, PoolScreen, BigField, MickeyDetail, TierDots });
Object.assign(window, { _LegacyRaceScreen: RaceScreen, _LegacyH2HScreen: H2HScreen });
