// shell.jsx — global layout, theme, navigation, route switching

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ─── Theme system ─────────────────────────────────────────────────────────────
const THEMES = {
  scoreboard: {
    name: 'Scoreboard',
    bg: '#0A0E0C',
    surface: '#101614',
    surfaceHi: '#161F1B',
    border: '#1F2A24',
    borderHi: '#2D3A33',
    text: '#F2EDE0',
    textMuted: '#7A8B82',
    textDim: '#4A5A52',
    accent: '#F5C518',     // scoreboard amber
    accentHot: '#FFD23F',
    diamond: '#1B5E3F',    // outfield green
    foul: '#C8312A',       // foul-line red
    bone: '#F2EDE0',
    legit: '#5BC272',
    mickey: '#E8693C',
  },
  dugout: {
    name: 'Dugout',
    bg: '#0B0908',
    surface: '#15110F',
    surfaceHi: '#1B1714',
    border: '#241F1B',
    borderHi: '#3A332D',
    text: '#F1E6D2',
    textMuted: '#8B7E6E',
    textDim: '#544A3F',
    accent: '#E0843C',     // worn leather
    accentHot: '#F5A65A',
    diamond: '#3D5A3D',
    foul: '#A83228',
    bone: '#F1E6D2',
    legit: '#86B36E',
    mickey: '#C75B3A',
  },
  bleachers: {
    name: 'Bleachers',
    bg: '#0B0F1A',
    surface: '#121726',
    surfaceHi: '#191F32',
    border: '#222B44',
    borderHi: '#34406A',
    text: '#E8EEF8',
    textMuted: '#7A86A0',
    textDim: '#4A5470',
    accent: '#4ECDC4',     // night LED
    accentHot: '#7FE3DB',
    diamond: '#2E7D5C',
    foul: '#FF5C5C',
    bone: '#E8EEF8',
    legit: '#5BD2A4',
    mickey: '#FF7A5C',
  },
};

const FONT_PAIRINGS = {
  broadcast: {
    name: 'Broadcast',
    display: '"Bricolage Grotesque", "Inter Display", system-ui, sans-serif',
    ui: '"Geist", "Inter", system-ui, sans-serif',
    mono: '"DM Mono", "JetBrains Mono", ui-monospace, monospace',
    digital: '"Doto", "DM Mono", monospace',
    displayWeight: 800,
    displayLetterSpacing: '-0.02em',
  },
  topps: {
    name: 'Topps',
    display: '"Anton", "Oswald", "Bricolage Grotesque", sans-serif',
    ui: '"Geist", "Inter", system-ui, sans-serif',
    mono: '"DM Mono", ui-monospace, monospace',
    digital: '"VT323", "DM Mono", monospace',
    displayWeight: 700,
    displayLetterSpacing: '-0.01em',
  },
  diamond: {
    name: 'Diamond',
    display: '"Big Shoulders Display", "Anton", sans-serif',
    ui: '"Space Grotesk", "Inter", system-ui, sans-serif',
    mono: '"Space Mono", "DM Mono", monospace',
    digital: '"Doto", "Space Mono", monospace',
    displayWeight: 800,
    displayLetterSpacing: '-0.015em',
  },
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "bleachers",
  "fontPairing": "diamond",
  "celebrationIntensity": "medium"
}/*EDITMODE-END*/;

// ─── App shell ────────────────────────────────────────────────────────────────
function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useState('standings');
  const [hrFeed, setHrFeed] = useState(window.HOME_RUNS);
  const [draftPicks, setDraftPicks] = useState(window.DRAFT_PICKS);
  const [celebration, setCelebration] = useState(null); // active HR toast
  const [teamHrs, setTeamHrs] = useState(() => Object.fromEntries(window.TEAMS.map(t => [t.id, t.hrs])));
  const [pulseTeamId, setPulseTeamId] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);

  const theme = THEMES[tweaks.theme] || THEMES.scoreboard;
  const fonts = FONT_PAIRINGS[tweaks.fontPairing] || FONT_PAIRINGS.broadcast;

  // Inject CSS variables onto :root so child components can read them
  useEffect(() => {
    const r = document.documentElement;
    Object.entries(theme).forEach(([k, v]) => {
      if (typeof v === 'string') r.style.setProperty(`--c-${k}`, v);
    });
    r.style.setProperty('--font-display', fonts.display);
    r.style.setProperty('--font-ui', fonts.ui);
    r.style.setProperty('--font-mono', fonts.mono);
    r.style.setProperty('--font-digital', fonts.digital);
    r.style.setProperty('--font-display-weight', fonts.displayWeight);
    r.style.setProperty('--font-display-spacing', fonts.displayLetterSpacing);
    document.body.style.background = theme.bg;
    document.body.style.color = theme.text;
    document.body.style.fontFamily = fonts.ui;
  }, [theme, fonts]);

  // Trigger a fake HR — used by the "Simulate HR" button + standings 'tap pulse'
  const simulateHR = useCallback(() => {
    const sluggers = window.PLAYERS.filter(p => p.tier <= 2 && p.fantasy_team);
    const player = sluggers[Math.floor(Math.random() * sluggers.length)];
    const team = window.TEAMS.find(t => t.name === player.fantasy_team);
    const dist = 380 + Math.floor(Math.random() * 100);
    const ev = 95 + Math.random() * 22;
    const la = 22 + Math.random() * 14;
    const mickeyMeter = Math.min(30, Math.max(2, Math.round((dist - 360) / 4 + (ev - 95) / 2)));
    const newHR = {
      id: 'hr_new_' + Date.now(),
      player,
      team,
      teamColor: window.TEAM_COLORS[window.TEAMS.indexOf(team)],
      distance: dist,
      exitVelo: +ev.toFixed(1),
      launchAngle: Math.round(la),
      mickeyMeter,
      mickeyLabel: mickeyMeter >= 18 ? 'LEGIT' : 'MICKEY MOUSE',
      spray: { x: 0.2 + Math.random() * 0.6, y: 0.1 + Math.random() * 0.5 },
      minutesAgo: 0,
      inning: ['T1','B2','T3','B4','T5','B5','T6','B7','T8','B8','T9'][Math.floor(Math.random()*11)],
      isFresh: true,
    };
    setHrFeed(prev => [newHR, ...prev].slice(0, 30));
    setTeamHrs(prev => ({ ...prev, [team.id]: (prev[team.id] || 0) + 1 }));
    setCelebration(newHR);
    setPulseTeamId(team.id);
    setTimeout(() => setPulseTeamId(null), 2400);
    setTimeout(() => setCelebration(c => (c && c.id === newHR.id ? null : c)), 6500);
  }, []);

  // Auto-simulate every 25s for ambient liveness
  useEffect(() => {
    const intv = setInterval(() => { simulateHR(); }, 25000);
    return () => clearInterval(intv);
  }, [simulateHR]);

  // Live "minutes ago" tick
  const [, forceTick] = useState(0);
  useEffect(() => {
    const intv = setInterval(() => forceTick(t => t + 1), 60000);
    return () => clearInterval(intv);
  }, []);

  // Build standings from teamHrs
  const standings = useMemo(() => {
    return window.TEAMS
      .map((t, idx) => ({ ...t, idx, hrs: teamHrs[t.id] ?? t.hrs, color: window.TEAM_COLORS[idx] }))
      .sort((a, b) => b.hrs - a.hrs);
  }, [teamHrs]);

  const NAV = [
    { id: 'standings', label: 'Standings',  glyph: 'STD' },
    { id: 'race',      label: 'The Race',   glyph: 'RAC' },
    { id: 'spray',     label: 'Spray',      glyph: 'SPR' },
    { id: 'rosters',   label: 'Rosters',    glyph: 'ROS' },
    { id: 'h2h',       label: 'Head to Head', glyph: 'H2H' },
    { id: 'draft',     label: 'Draft',      glyph: 'DFT' },
    { id: 'pool',      label: 'Player Pool',glyph: 'PL' },
  ];

  return (
    <div className="app">
      <TopBar
        nav={NAV} route={route} setRoute={setRoute}
        onSimulate={simulateHR}
        liveCount={hrFeed.length}
        onOpenAdmin={() => setAdminOpen(true)}
      />

      <main className="main-pane">
        {route === 'standings' && (
          <StandingsScreen
            standings={standings}
            hrFeed={hrFeed}
            pulseTeamId={pulseTeamId}
            onSimulate={simulateHR}
          />
        )}
        {route === 'race'    && <RaceScreen standings={standings} />}
        {route === 'spray'   && <SprayScreen hrFeed={hrFeed} standings={standings} />}
        {route === 'rosters' && <RostersScreen standings={standings} />}
        {route === 'h2h'     && <H2HScreen standings={standings} />}
        {route === 'draft'   && <DraftScreen draftPicks={draftPicks} setDraftPicks={setDraftPicks} />}
        {route === 'pool'    && <PoolScreen draftPicks={draftPicks} />}
      </main>

      {celebration && (
        <CelebrationToast
          hr={celebration}
          intensity={tweaks.celebrationIntensity}
          onClose={() => setCelebration(null)}
        />
      )}

      {adminOpen && (
        <AdminScreen
          onClose={() => setAdminOpen(false)}
          standings={standings}
          simulateHR={simulateHR}
        />
      )}

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakRadio
          label="Palette"
          value={tweaks.theme}
          options={['scoreboard', 'dugout', 'bleachers']}
          onChange={(v) => setTweak('theme', v)}
        />
        <TweakSection label="Typography" />
        <TweakRadio
          label="Pairing"
          value={tweaks.fontPairing}
          options={['broadcast', 'topps', 'diamond']}
          onChange={(v) => setTweak('fontPairing', v)}
        />
        <TweakSection label="HR celebration" />
        <TweakRadio
          label="Intensity"
          value={tweaks.celebrationIntensity}
          options={['subtle', 'medium', 'big']}
          onChange={(v) => setTweak('celebrationIntensity', v)}
        />
        <TweakButton label="Simulate a Dinger" onClick={simulateHR} />
      </TweaksPanel>
    </div>
  );
}

// ─── Top bar ──────────────────────────────────────────────────────────────────
function TopBar({ nav, route, setRoute, onSimulate, liveCount, onOpenAdmin }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            <svg viewBox="0 0 32 32" width="28" height="28">
              <circle cx="16" cy="16" r="14" fill="var(--c-bone)" stroke="var(--c-foul)" strokeWidth="1.5"/>
              <path d="M 6 22 Q 16 6 26 22" stroke="var(--c-foul)" strokeWidth="1.2" fill="none"/>
              <path d="M 6 10 Q 16 26 26 10" stroke="var(--c-foul)" strokeWidth="1.2" fill="none"/>
            </svg>
          </div>
          <div className="brand-stack">
            <div className="brand-name">DINGERS, PLEASE</div>
            <div className="brand-sub">EST. 2026 · POST-ASB</div>
          </div>
        </div>

        <nav className="topnav">
          {nav.map(n => (
            <button
              key={n.id}
              className={`navbtn${route === n.id ? ' is-active' : ''}`}
              onClick={() => setRoute(n.id)}
            >
              <span className="navbtn-glyph">{n.glyph}</span>
              <span className="navbtn-label">{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="topbar-right">
          <div className="livepill">
            <span className="livedot" />
            <span className="livetxt">LIVE</span>
            <span className="livecount">{liveCount}</span>
          </div>
          <button className="lock-btn" onClick={onOpenAdmin} title="Commissioner admin" aria-label="Open admin">
            <svg viewBox="0 0 16 16" width="14" height="14">
              <rect x="3" y="7" width="10" height="7" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M5.5 7 V 5 a 2.5 2.5 0 0 1 5 0 V 7" fill="none" stroke="currentColor" strokeWidth="1.4"/>
              <circle cx="8" cy="10" r="1" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── HR Celebration Toast ─────────────────────────────────────────────────────
function CelebrationToast({ hr, intensity, onClose }) {
  const big = intensity === 'big';
  const subtle = intensity === 'subtle';
  return (
    <div className={`toast toast-${intensity}`} style={{ '--team': hr.teamColor }}>
      <div className="toast-bar" />
      <div className="toast-body">
        <div className="toast-row1">
          <span className="toast-eyebrow">DINGER · {hr.inning}</span>
          <button className="toast-x" onClick={onClose} aria-label="Dismiss">×</button>
        </div>
        <div className="toast-name">{hr.player.name}</div>
        <div className="toast-team">{hr.team.name}</div>
        {!subtle && (
          <div className="toast-stats">
            <Stat label="DIST" value={<TickUp to={hr.distance} suffix=" ft" />} />
            <Stat label="EV"   value={<TickUp to={hr.exitVelo} suffix=" mph" decimals={1} />} />
            <Stat label="LA"   value={<TickUp to={hr.launchAngle} suffix="°" />} />
            <Stat label="METER" value={<MickeyTag mm={hr.mickeyMeter} label={hr.mickeyLabel} />} />
          </div>
        )}
        {big && (
          <div className="toast-spray">
            <MiniField spray={hr.spray} color={hr.teamColor} />
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function TickUp({ to, suffix = '', decimals = 0, duration = 900 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return <span>{v.toFixed(decimals)}{suffix}</span>;
}

function MickeyTag({ mm, label }) {
  const ok = label === 'LEGIT';
  return (
    <span className={`mickey-tag ${ok ? 'is-legit' : 'is-mouse'}`}>
      <span className="mickey-num">{mm}</span>
      <span className="mickey-of">/30</span>
    </span>
  );
}

function MiniField({ spray, color }) {
  // Simple field SVG with a dot at spray.x / spray.y (0..1 in field space)
  return (
    <svg viewBox="0 0 200 140" className="minifield">
      <defs>
        <linearGradient id="grass" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--c-diamond)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--c-diamond)" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d="M 100 130 L 20 50 Q 100 -10 180 50 Z" fill="url(#grass)" stroke="var(--c-borderHi)" strokeWidth="0.8"/>
      <line x1="100" y1="130" x2="20" y2="50" stroke="var(--c-borderHi)" strokeWidth="0.6"/>
      <line x1="100" y1="130" x2="180" y2="50" stroke="var(--c-borderHi)" strokeWidth="0.6"/>
      <polygon points="100,118 88,106 100,94 112,106" fill="none" stroke="var(--c-borderHi)" strokeWidth="0.6"/>
      <circle cx="100" cy="106" r="1.5" fill="var(--c-borderHi)"/>
      {/* Spray dot */}
      <circle
        cx={20 + spray.x * 160}
        cy={50 + spray.y * 60}
        r="3.5"
        fill={color}
        stroke="var(--c-bg)"
        strokeWidth="1"
        style={{ filter: 'drop-shadow(0 0 6px ' + color + ')' }}
      >
        <animate attributeName="r" from="0" to="4" dur="0.6s" fill="freeze" />
      </circle>
      {/* Trail line from home plate to dot */}
      <line
        x1="100" y1="118"
        x2={20 + spray.x * 160} y2={50 + spray.y * 60}
        stroke={color} strokeWidth="0.8" strokeDasharray="2 3" opacity="0.55"
      >
        <animate attributeName="stroke-dashoffset" from="80" to="0" dur="0.7s" fill="freeze" />
      </line>
    </svg>
  );
}

Object.assign(window, { App, THEMES, FONT_PAIRINGS, TickUp, MickeyTag, MiniField, Stat });
