'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Team, Player, DraftPick } from '@/lib/types';
import { getTeamColor } from '@/lib/types';

const ROUNDS    = 9;
const POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

function buildPickOrder(teamCount: number, rounds: number) {
  const picks: { round: number; teamIndex: number; pickInRound: number; overall: number }[] = [];
  let overall = 0;
  for (let r = 1; r <= rounds; r++) {
    const snake = r % 2 === 0;
    for (let p = 0; p < teamCount; p++) {
      overall++;
      picks.push({ round: r, teamIndex: snake ? teamCount - 1 - p : p, pickInRound: p + 1, overall });
    }
  }
  return picks;
}

function TierDots({ hrs }: { hrs: number }) {
  const tier = hrs >= 5 ? 1 : hrs >= 3 ? 2 : hrs >= 2 ? 3 : hrs >= 1 ? 4 : 5;
  return (
    <span className="tier-dots">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`tdot${i <= (6 - tier) ? ' is-on' : ''}`} />
      ))}
    </span>
  );
}

type Props = {
  initialTeams:   Team[];
  initialPicks:   DraftPick[];
  initialPlayers: Player[];
};

export default function DraftBoard({ initialTeams, initialPicks, initialPlayers }: Props) {
  const [teams,   setTeams]   = useState<Team[]>(initialTeams);
  const [picks,   setPicks]   = useState<DraftPick[]>(initialPicks);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [newPickIds, setNewPickIds] = useState<Set<string>>(new Set());

  const [pin,        setPin]        = useState('');
  const [authed,     setAuthed]     = useState(false);
  const [pinError,   setPinError]   = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  const [search,    setSearch]    = useState('');
  const [posFilter, setPosFilter] = useState<string>('ALL');
  const [selected,  setSelected]  = useState<Player | null>(null);
  const [status,    setStatus]    = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading,   setLoading]   = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  async function tryUnlock() {
    if (!pin) { setPinError('Enter your PIN'); return; }
    setPinLoading(true);
    setPinError('');
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPin: pin, action: 'verify' }),
    });
    setPinLoading(false);
    if (res.ok) { setAuthed(true); }
    else         { setPinError('Invalid PIN'); }
  }

  useEffect(() => {
    async function fetchFresh() {
      const [{ data: freshPicks }, { data: freshPlayers }] = await Promise.all([
        supabase
          .from('draft_picks')
          .select('*, players(id, name, position, mlb_team), teams(id, name)')
          .eq('season', 2026)
          .order('overall_pick'),
        supabase
          .from('players')
          .select('id, name, position, mlb_team, team_id, mlb_player_id, created_at')
          .order('name'),
      ]);
      if (freshPicks)   setPicks(freshPicks as DraftPick[]);
      if (freshPlayers) setPlayers(freshPlayers as Player[]);
    }
    fetchFresh();
  }, []);

  const refreshPlayers = useCallback(async () => {
    const { data } = await supabase
      .from('players')
      .select('id, name, position, mlb_team, team_id, mlb_player_id, created_at')
      .order('name');
    if (data) setPlayers(data as Player[]);
  }, []);

  const refreshPick = useCallback(async (newPick: DraftPick) => {
    const { data } = await supabase
      .from('draft_picks')
      .select('*, players(id, name, position, mlb_team), teams(id, name)')
      .eq('id', newPick.id)
      .single();
    if (data) {
      setPicks(prev => [...prev, data as DraftPick]);
      setNewPickIds(prev => new Set([...Array.from(prev), newPick.id]));
      setTimeout(() => setNewPickIds(prev => { const n = new Set(Array.from(prev)); n.delete(newPick.id); return n; }), 1400);
    }
  }, []);

  useEffect(() => {
    const ch = supabase.channel('draft-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players' }, () => refreshPlayers())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'draft_picks' }, payload => refreshPick(payload.new as DraftPick))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refreshPlayers, refreshPick]);

  // Derived
  const sortedTeams = [...teams].sort((a, b) => (a.draft_position ?? 99) - (b.draft_position ?? 99));
  const pickMap     = new Map<string, DraftPick>();
  for (const pick of picks) {
    const pos = pick.players?.position;
    if (pos && pick.team_id) pickMap.set(`${pick.team_id}:${pos}`, pick);
  }

  const teamCount   = sortedTeams.length || 10;
  const totalPicks  = teamCount * ROUNDS;
  const pickOrder   = buildPickOrder(teamCount, ROUNDS);
  const currentIdx  = picks.length;
  const isDraftDone = currentIdx >= pickOrder.length;
  const currentPick = isDraftDone ? null : pickOrder[currentIdx];
  const currentTeam = currentPick ? sortedTeams[currentPick.teamIndex] : null;
  const teamColor   = currentTeam ? getTeamColor(currentTeam.id) : 'var(--c-accent)';

  const takenPositions = new Set(
    currentTeam ? picks.filter(p => p.team_id === currentTeam.id).map(p => p.players?.position).filter(Boolean) as string[] : []
  );

  const undrafted = players.filter(p => p.team_id === null);
  const filtered  = undrafted.filter(p => {
    if (posFilter !== 'ALL' && p.position !== posFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function submitPick() {
    if (!selected) return;
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch('/api/draft/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin: pin, playerId: selected.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ ok: false, msg: data.error ?? 'Unknown error' });
      } else {
        setStatus({ ok: true, msg: `${data.player} → ${data.team} (Rd ${data.round}, Pick ${data.overallPick})` });
        setSelected(null);
        setSearch('');
        setTimeout(() => searchRef.current?.focus(), 50);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen">
      {/* ── On the clock banner ─────────────────────────────────────────── */}
      <div
        className={`onclock${isDraftDone ? ' is-done' : ''}`}
        style={!isDraftDone ? { '--team': teamColor } as React.CSSProperties : {}}
      >
        {isDraftDone ? (
          <div className="onclock-done">
            <div className="onclock-eyebrow">DRAFT COMPLETE</div>
            <div className="onclock-name">All {totalPicks} picks made</div>
          </div>
        ) : (
          <>
            <div className="onclock-l">
              <div className="onclock-eyebrow">ON THE CLOCK</div>
              <div className="onclock-name">{currentTeam?.name}</div>
            </div>
            <div className="onclock-m">
              <div className="onclock-pickbig">
                <div className="onclock-num">#{picks.length + 1}</div>
                <div className="onclock-of">/ {totalPicks}</div>
              </div>
              <div className="onclock-rd">RD {currentPick?.round} · PICK {currentPick?.pickInRound}</div>
            </div>
            <div className="onclock-r">
              <div className="onclock-clock">
                <div className="clock-num">—:——</div>
                <div className="clock-lbl">PICK CLOCK</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Pick panel ─────────────────────────────────────────────────── */}
      {!isDraftDone && (
        <div className="card draft-pick">
          {!authed ? (
            <div className="pin-row">
              <div className="pin-eyebrow">COMMISSIONER PIN REQUIRED TO MAKE PICKS</div>
              <div className="pin-fields">
                <input
                  type="password"
                  className="pin-input"
                  placeholder="••••"
                  value={pin}
                  onChange={e => { setPin(e.target.value); setPinError(''); }}
                  onKeyDown={e => e.key === 'Enter' && tryUnlock()}
                />
                <button className="btn-primary" onClick={tryUnlock} disabled={pinLoading}>
                  {pinLoading ? '…' : 'Unlock'}
                </button>
                <span className={`pin-msg${pinError ? ' is-err' : ''}`}>
                  {pinError || 'Viewers can watch without a PIN'}
                </span>
              </div>
            </div>
          ) : (
            <div className="pick-flow">
              <div className="pick-row">
                <input
                  ref={searchRef}
                  className="pick-search"
                  placeholder="Search batter to draft…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setSelected(null); }}
                  autoFocus
                />
                <div className="pick-pos-filters">
                  {['ALL', ...POSITIONS].map(pos => {
                    const blocked = pos !== 'ALL' && takenPositions.has(pos);
                    return (
                      <button
                        key={pos}
                        className={`posbtn${posFilter === pos ? ' is-on' : ''}${blocked ? ' is-blocked' : ''}`}
                        style={blocked ? { opacity: 0.3, textDecoration: 'line-through' } : {}}
                        onClick={() => !blocked && setPosFilter(pos)}
                        disabled={blocked}
                      >
                        {pos}
                      </button>
                    );
                  })}
                </div>
              </div>

              {search.length > 0 && (
                <div className="pick-list">
                  {filtered.length === 0 && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--c-textDim)', letterSpacing: '0.1em', padding: '12px 0' }}>
                      NO PLAYERS MATCH
                    </div>
                  )}
                  {filtered.slice(0, 14).map(p => {
                    const blocked = takenPositions.has(p.position);
                    return (
                      <button
                        key={p.id}
                        className={`pick-item${selected?.id === p.id ? ' is-sel' : ''}${blocked ? ' is-blocked' : ''}`}
                        onClick={() => !blocked && setSelected(p)}
                        disabled={blocked}
                      >
                        <span className="pi-name">{p.name}</span>
                        <span className="pi-mlb">{p.mlb_team ?? '—'}</span>
                        <span className="pi-pos">{p.position}</span>
                        <TierDots hrs={0} />
                      </button>
                    );
                  })}
                </div>
              )}

              {selected && (
                <div className="pick-confirm">
                  <button
                    className="btn-primary btn-big"
                    onClick={submitPick}
                    disabled={loading}
                    style={{ background: teamColor, borderColor: teamColor }}
                  >
                    {loading ? 'Picking…' : `DRAFT ${selected.name} (${selected.position}) → ${currentTeam?.name}`}
                  </button>
                  <button className="btn-ghost" onClick={() => { setSelected(null); setSearch(''); }}>
                    Cancel
                  </button>
                </div>
              )}

              {status && (
                <div className={`pick-status ${status.ok ? 'is-ok' : 'is-err'}`}>
                  <span>{status.ok ? '✓' : '✕'}</span> {status.msg}
                </div>
              )}

              <button
                onClick={() => { setAuthed(false); setPin(''); }}
                style={{ background: 'transparent', border: 'none', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--c-textDim)', letterSpacing: '0.1em', cursor: 'pointer', alignSelf: 'flex-start' }}
              >
                LOCK ADMIN
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Snake board ─────────────────────────────────────────────────── */}
      <div className="card draft-board-card">
        <div className="card-head">
          <h2 className="card-title">Snake Board</h2>
          <span className="card-sub">{picks.length} OF {totalPicks} PICKS</span>
        </div>
        <div className="snake-scroll">
          <table className="snake">
            <thead>
              <tr>
                <th className="snake-pos-head">POS</th>
                {sortedTeams.map((t, i) => {
                  const color = getTeamColor(t.id);
                  const isOn  = currentTeam?.id === t.id;
                  return (
                    <th
                      key={t.id}
                      className={`snake-team${isOn ? ' is-on' : ''}`}
                      style={{ '--team': color } as React.CSSProperties}
                    >
                      <div className="snake-team-rank">{i + 1}</div>
                      <div className="snake-team-name">{t.name}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {POSITIONS.map(pos => (
                <tr key={pos}>
                  <td className="snake-pos">{pos}</td>
                  {sortedTeams.map(t => {
                    const cell      = pickMap.get(`${t.id}:${pos}`);
                    const isCurrent = !cell && currentTeam?.id === t.id;
                    const isNew     = cell ? newPickIds.has(cell.id) : false;
                    const color     = getTeamColor(t.id);
                    return (
                      <td
                        key={t.id}
                        className={`snake-cell${cell ? ' has-pick' : ''}${isCurrent ? ' is-current' : ''}${isNew ? ' is-new' : ''}`}
                        style={isCurrent ? { '--team': color } as React.CSSProperties : {}}
                      >
                        {cell ? (
                          <div className="cell-pick">
                            <div className="cell-name">{cell.players?.name ?? '—'}</div>
                            <div className="cell-mlb">{(cell.players as any)?.mlb_team ?? ''}</div>
                          </div>
                        ) : isCurrent ? (
                          <span className="cell-target">▼</span>
                        ) : (
                          <span className="cell-empty">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pick log ────────────────────────────────────────────────────── */}
      {picks.length > 0 && (
        <div className="card pick-log">
          <div className="card-head">
            <h2 className="card-title">Pick Log</h2>
            <span className="card-sub">{picks.length} PICKS</span>
          </div>
          <div className="log-rows">
            {[...picks].reverse().map(pick => {
              const color = getTeamColor(pick.team_id);
              return (
                <div key={pick.id} className="log-row" style={{ '--team': color } as React.CSSProperties}>
                  <span className="log-num">#{String(pick.overall_pick).padStart(3, '0')}</span>
                  <span className="log-rd">RD{pick.round}.{pick.pick_in_round}</span>
                  <span className="log-team">{pick.teams?.name}</span>
                  <span className="log-arrow">→</span>
                  <span className="log-player">{pick.players?.name}</span>
                  <span className="log-mlb">{(pick.players as any)?.mlb_team ?? ''}</span>
                  <span className="log-pos">{pick.players?.position}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
