'use client';

import { useMemo, useState } from 'react';
import type { HomeRun, TeamStanding } from '@/lib/types';
import { getTeamColor, mickeyTier } from '@/lib/types';

// ─── Derived row ───────────────────────────────────────────────────────────────
type Row = {
  hr: HomeRun;
  player: string;
  squad: string;
  teamId: string;
  draftPosition: number | null;
  playerNum: number; // this player's Nth HR
  teamNum: number;   // this squad's Nth HR
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!m) return iso;
  return `${m}/${d}/${y.slice(2)}`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '—';
  }
}

// ─── Column config ───────────────────────────────────────────────────────────────
type ColKey =
  | 'date' | 'time' | 'player' | 'squad' | 'pnum' | 'tnum'
  | 'dist' | 'la' | 'ev' | 'x' | 'y' | 'mickey';

type Col = {
  key: ColKey;
  label: string;
  numeric: boolean;
  sortVal: (r: Row) => number | string | null;
};

const COLS: Col[] = [
  { key: 'date',   label: 'Date',   numeric: false, sortVal: r => r.hr.game_date ?? '' },
  { key: 'time',   label: 'Time',   numeric: false, sortVal: r => r.hr.hit_at ?? '' },
  { key: 'player', label: 'Player', numeric: false, sortVal: r => r.player.toLowerCase() },
  { key: 'squad',  label: 'Squad',  numeric: false, sortVal: r => r.squad.toLowerCase() },
  { key: 'pnum',   label: 'Plyr #', numeric: true,  sortVal: r => r.playerNum },
  { key: 'tnum',   label: 'Sqd #',  numeric: true,  sortVal: r => r.teamNum },
  { key: 'dist',   label: 'Dist',   numeric: true,  sortVal: r => r.hr.distance },
  { key: 'la',     label: 'LA',     numeric: true,  sortVal: r => r.hr.launch_angle },
  { key: 'ev',     label: 'EV',     numeric: true,  sortVal: r => r.hr.launch_speed },
  { key: 'x',      label: 'X',      numeric: true,  sortVal: r => r.hr.spray_x },
  { key: 'y',      label: 'Y',      numeric: true,  sortVal: r => r.hr.spray_y },
  { key: 'mickey', label: 'Mickey', numeric: true,  sortVal: r => r.hr.mickey_meter_count },
];

// ─── Summary stat helpers ───────────────────────────────────────────────────────
type StatLine = { label: string; value: string; sub?: string };

function pill(v: number | null, unit = '') {
  return v == null ? '—' : `${v}${unit}`;
}

export default function DataRoom({
  homeRuns,
  standings,
}: {
  homeRuns: HomeRun[];
  standings: TeamStanding[];
}) {
  // Assign running per-player / per-team sequence numbers (input is hit_at asc).
  const rows: Row[] = useMemo(() => {
    const pCount: Record<string, number> = {};
    const tCount: Record<string, number> = {};
    return homeRuns.map(hr => {
      const pid = hr.player_id;
      const teamId = (hr.players as any)?.team_id ?? '';
      pCount[pid] = (pCount[pid] || 0) + 1;
      if (teamId) tCount[teamId] = (tCount[teamId] || 0) + 1;
      return {
        hr,
        player: hr.players?.name ?? '—',
        squad: hr.players?.teams?.name ?? '—',
        teamId,
        draftPosition: (hr.players as any)?.teams?.draft_position ?? null,
        playerNum: pCount[pid],
        teamNum: teamId ? tCount[teamId] : 0,
      };
    });
  }, [homeRuns]);

  // ── Filters + sort state ──
  const [player, setPlayer] = useState('');
  const [squad, setSquad] = useState('');
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<ColKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const playerOpts = useMemo(
    () => Array.from(new Set(rows.map(r => r.player))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const squadOpts = useMemo(
    () => Array.from(new Set(rows.map(r => r.squad))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const view = useMemo(() => {
    let out = rows;
    if (player) out = out.filter(r => r.player === player);
    if (squad) out = out.filter(r => r.squad === squad);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      out = out.filter(r => r.player.toLowerCase().includes(needle) || r.squad.toLowerCase().includes(needle));
    }
    const col = COLS.find(c => c.key === sortKey)!;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...out].sort((a, b) => {
      const av = col.sortVal(a);
      const bv = col.sortVal(b);
      // nulls always sink to the bottom regardless of direction
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [rows, player, squad, q, sortKey, sortDir]);

  function toggleSort(key: ColKey) {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      const col = COLS.find(c => c.key === key)!;
      setSortDir(col.numeric || key === 'date' || key === 'time' ? 'desc' : 'asc');
    }
  }

  function resetFilters() {
    setPlayer('');
    setSquad('');
    setQ('');
  }

  // ── Summary statistics (computed over ALL rows, not the filtered view) ──
  const stats = useMemo(() => buildStats(rows, standings), [rows, standings]);

  const hasHRs = rows.length > 0;

  return (
    <>
      {hasHRs && (
        <div className="dr-stats">
          {stats.map(group => (
            <div className="card dr-statcard" key={group.title}>
              <div className="dr-statcard-head">
                <span className="dr-statcard-icon" aria-hidden>{group.icon}</span>
                <h2 className="card-title">{group.title}</h2>
              </div>
              <div className="dr-statlist">
                {group.lines.map(l => (
                  <div className="dr-statline" key={l.label}>
                    <span className="dr-statline-label">{l.label}</span>
                    <span className="dr-statline-value">
                      {l.value}
                      {l.sub && <span className="dr-statline-sub">{l.sub}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card dr-tablecard">
        <div className="dr-controls">
          <div className="dr-filters">
            <label className="dr-field">
              <span>Player</span>
              <select value={player} onChange={e => setPlayer(e.target.value)}>
                <option value="">All</option>
                {playerOpts.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="dr-field">
              <span>Squad</span>
              <select value={squad} onChange={e => setSquad(e.target.value)}>
                <option value="">All</option>
                {squadOpts.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="dr-field dr-field-search">
              <span>Search</span>
              <input
                type="text"
                placeholder="player or squad…"
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </label>
            {(player || squad || q) && (
              <button className="btn-ghost dr-reset" onClick={resetFilters}>Reset</button>
            )}
          </div>
          <div className="dr-count">{view.length} of {rows.length}</div>
        </div>

        <div className="dr-scroll">
          <table className="dr-table">
            <thead>
              <tr>
                {COLS.map(c => (
                  <th
                    key={c.key}
                    className={`${c.numeric ? 'is-num' : ''}${sortKey === c.key ? ' is-sorted' : ''}`}
                    onClick={() => toggleSort(c.key)}
                  >
                    {c.label}
                    <span className="dr-arrow">{sortKey === c.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.map(r => {
                const color = r.teamId ? getTeamColor(r.teamId, r.draftPosition) : '#888';
                const legit = mickeyTier(r.hr.mickey_meter_count).tone === 'legit';
                return (
                  <tr key={r.hr.id}>
                    <td>{fmtDate(r.hr.game_date)}</td>
                    <td className="dr-dim">{fmtTime(r.hr.hit_at)}</td>
                    <td className="dr-player">{r.player}</td>
                    <td>
                      <span className="dr-squad">
                        <span className="dr-dot" style={{ background: color }} />
                        {r.squad}
                      </span>
                    </td>
                    <td className="is-num">{r.playerNum}</td>
                    <td className="is-num">{r.teamNum || '—'}</td>
                    <td className="is-num">{pill(r.hr.distance)}</td>
                    <td className="is-num">{r.hr.launch_angle != null ? `${r.hr.launch_angle}°` : '—'}</td>
                    <td className="is-num">{pill(r.hr.launch_speed)}</td>
                    <td className="is-num dr-dim">{r.hr.spray_x != null ? r.hr.spray_x.toFixed(1) : '—'}</td>
                    <td className="is-num dr-dim">{r.hr.spray_y != null ? r.hr.spray_y.toFixed(1) : '—'}</td>
                    <td className="is-num">
                      {r.hr.mickey_meter_count != null ? (
                        <span className={`dr-mickey${legit ? ' is-legit' : ' is-mouse'}`}>
                          {r.hr.mickey_meter_count}<span className="dr-mickey-of">/30</span>
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
              {view.length === 0 && (
                <tr><td colSpan={COLS.length} className="dr-empty">No dingers match those filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── Summary stat builder ───────────────────────────────────────────────────────
function buildStats(rows: Row[], standings: TeamStanding[]) {
  const withDist = rows.filter(r => r.hr.distance != null);
  const withLA = rows.filter(r => r.hr.launch_angle != null);
  const withEV = rows.filter(r => r.hr.launch_speed != null);

  const maxBy = <T,>(arr: T[], f: (t: T) => number) =>
    arr.length ? arr.reduce((m, x) => (f(x) > f(m) ? x : m)) : null;
  const minBy = <T,>(arr: T[], f: (t: T) => number) =>
    arr.length ? arr.reduce((m, x) => (f(x) < f(m) ? x : m)) : null;

  // ── Hot & cold over the trailing 5 game-dates present in the data ──
  const dates = Array.from(new Set(rows.map(r => r.hr.game_date))).sort();
  const maxDate = dates[dates.length - 1];
  const windowStart = (() => {
    if (!maxDate) return null;
    const d = new Date(`${maxDate}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 4);
    return d.toISOString().split('T')[0];
  })();
  const recent = windowStart ? rows.filter(r => r.hr.game_date >= windowStart) : [];

  const recentByPlayer: Record<string, number> = {};
  for (const r of recent) recentByPlayer[r.player] = (recentByPlayer[r.player] || 0) + 1;
  const hotPlayers = Object.entries(recentByPlayer).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const recentByTeam: Record<string, number> = {};
  for (const r of recent) recentByTeam[r.squad] = (recentByTeam[r.squad] || 0) + 1;
  // every squad, including those with zero in the window
  const coldTeams = standings
    .map(t => ({ name: t.team_name, n: recentByTeam[t.team_name] || 0 }))
    .sort((a, b) => a.n - b.n)
    .slice(0, 3);

  const hotLines: StatLine[] = hotPlayers.length
    ? hotPlayers.map(([name, n]) => ({ label: name, value: `${n}`, sub: ' HR' }))
    : [{ label: 'No dingers in window', value: '—' }];
  const coldLines: StatLine[] = coldTeams.map(t => ({ label: t.name, value: `${t.n}`, sub: ' HR' }));

  // ── Distance & launch extremes ──
  const longest = maxBy(withDist, r => r.hr.distance!);
  const shortest = minBy(withDist, r => r.hr.distance!);
  const highLA = maxBy(withLA, r => r.hr.launch_angle!);
  const lowLA = minBy(withLA, r => r.hr.launch_angle!);
  const topEV = maxBy(withEV, r => r.hr.launch_speed!);

  const extremeLines: StatLine[] = [
    longest && { label: 'Longest', value: `${longest.hr.distance} ft`, sub: ` · ${longest.player}` },
    shortest && { label: 'Cheapest', value: `${shortest.hr.distance} ft`, sub: ` · ${shortest.player}` },
    topEV && { label: 'Hardest hit', value: `${topEV.hr.launch_speed} mph`, sub: ` · ${topEV.player}` },
    highLA && { label: 'Highest LA', value: `${highLA.hr.launch_angle}°`, sub: ` · ${highLA.player}` },
    lowLA && { label: 'Lowest LA', value: `${lowLA.hr.launch_angle}°`, sub: ` · ${lowLA.player}` },
  ].filter(Boolean) as StatLine[];

  // ── Streaks & pace ──
  // Busiest day
  const byDay: Record<string, number> = {};
  for (const r of rows) byDay[r.hr.game_date] = (byDay[r.hr.game_date] || 0) + 1;
  const busiest = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0] ?? null;

  // Longest consecutive-day HR streak (per player, over distinct game-dates)
  const daysByPlayer: Record<string, string[]> = {};
  for (const r of rows) {
    (daysByPlayer[r.player] ||= []).push(r.hr.game_date);
  }
  let streakName = '';
  let streakLen = 0;
  for (const [name, ds] of Object.entries(daysByPlayer)) {
    const uniq = Array.from(new Set(ds)).sort();
    let best = 1, cur = 1;
    for (let i = 1; i < uniq.length; i++) {
      const prev = new Date(`${uniq[i - 1]}T12:00:00Z`);
      prev.setUTCDate(prev.getUTCDate() + 1);
      if (prev.toISOString().split('T')[0] === uniq[i]) cur += 1;
      else cur = 1;
      if (cur > best) best = cur;
    }
    if (best > streakLen) { streakLen = best; streakName = name; }
  }

  const pace = dates.length ? (rows.length / dates.length) : 0;

  const streakLines: StatLine[] = [
    busiest && { label: 'Busiest day', value: `${busiest[1]}`, sub: ` HR · ${fmtDate(busiest[0])}` },
    streakName && { label: 'Longest streak', value: `${streakLen}`, sub: ` day${streakLen === 1 ? '' : 's'} · ${streakName}` },
    { label: 'Pace', value: pace.toFixed(1), sub: ' HR / game day' },
  ].filter(Boolean) as StatLine[];

  return [
    { title: 'Hot Bats · Last 5d', icon: '🔥', lines: hotLines },
    { title: 'Gone Quiet · Last 5d', icon: '🧊', lines: coldLines },
    { title: 'Distance & Launch', icon: '📏', lines: extremeLines },
    { title: 'Streaks & Pace', icon: '📈', lines: streakLines },
  ];
}
