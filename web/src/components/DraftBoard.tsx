'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Team, Player, DraftPick } from '@/lib/types';

const ROUNDS     = 9;
const TEAM_COUNT = 10;
const POSITIONS  = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

function buildPickOrder(teamCount: number, rounds: number) {
  const picks: { round: number; teamIndex: number; pickInRound: number; overall: number }[] = [];
  let overall = 0;
  for (let r = 1; r <= rounds; r++) {
    const snake = r % 2 === 0;
    for (let p = 0; p < teamCount; p++) {
      overall++;
      picks.push({
        round:       r,
        teamIndex:   snake ? teamCount - 1 - p : p,
        pickInRound: p + 1,
        overall,
      });
    }
  }
  return picks;
}

type Props = {
  initialTeams:  Team[];
  initialPicks:  DraftPick[];
  initialPlayers: Player[];
};

export default function DraftBoard({ initialTeams, initialPicks, initialPlayers }: Props) {
  const [teams,   setTeams]   = useState<Team[]>(initialTeams);
  const [picks,   setPicks]   = useState<DraftPick[]>(initialPicks);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);

  // Admin UI state
  const [pin,       setPin]       = useState('');
  const [authed,    setAuthed]    = useState(false);
  const [search,    setSearch]    = useState('');
  const [posFilter, setPosFilter] = useState<string>('ALL');
  const [selected,  setSelected]  = useState<Player | null>(null);
  const [status,    setStatus]    = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading,   setLoading]   = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // On mount, fetch fresh state (handles navigating back to this page mid-draft)
  useEffect(() => {
    async function fetchFresh() {
      const [{ data: freshPicks }, { data: freshPlayers }] = await Promise.all([
        supabase
          .from('draft_picks')
          .select('*, players(id, name, position), teams(id, name)')
          .eq('season', 2026)
          .order('overall_pick'),
        supabase
          .from('players')
          .select('id, name, position, team_id, mlb_player_id, created_at')
          .order('name'),
      ]);
      if (freshPicks)   setPicks(freshPicks as DraftPick[]);
      if (freshPlayers) setPlayers(freshPlayers as Player[]);
    }
    fetchFresh();
  }, []);

  // Realtime: players + draft_picks
  useEffect(() => {
    const ch = supabase.channel('draft-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players' }, () => {
        refreshPlayers();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'draft_picks' }, (payload) => {
        refreshPick(payload.new as DraftPick);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  const refreshPlayers = useCallback(async () => {
    const { data } = await supabase
      .from('players')
      .select('id, name, position, team_id, mlb_player_id, created_at')
      .order('name');
    if (data) setPlayers(data as Player[]);
  }, []);

  const refreshPick = useCallback(async (newPick: DraftPick) => {
    const { data } = await supabase
      .from('draft_picks')
      .select('*, players(id, name, position), teams(id, name)')
      .eq('id', newPick.id)
      .single();
    if (data) setPicks(prev => [...prev, data as DraftPick]);
  }, []);

  // Derived: what has been picked
  const pickMap = new Map<string, DraftPick>(); // `${teamId}:${position}` → pick
  for (const pick of picks) {
    const pos = pick.players?.position;
    if (pos && pick.team_id) pickMap.set(`${pick.team_id}:${pos}`, pick);
  }

  const pickOrder = buildPickOrder(TEAM_COUNT, ROUNDS);
  const currentIdx  = picks.length;
  const isDraftDone = currentIdx >= pickOrder.length;
  const currentPick = isDraftDone ? null : pickOrder[currentIdx];
  const currentTeam = currentPick ? teams[currentPick.teamIndex] : null;

  // Available (undrafted) players filtered
  const undrafted = players.filter(p => p.team_id === null);
  const filtered  = undrafted.filter(p => {
    const matchPos = posFilter === 'ALL' || p.position === posFilter;
    const matchSearch = search === '' ||
      p.name.toLowerCase().includes(search.toLowerCase());
    return matchPos && matchSearch;
  });

  // What positions does the current team already have drafted?
  const currentTeamPicks = currentTeam
    ? picks.filter(p => p.team_id === currentTeam.id)
    : [];
  const takenPositions = new Set(currentTeamPicks.map(p => p.players?.position).filter(Boolean));

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
        setStatus({ ok: true, msg: `✅ ${data.player} → ${data.team} (Rd ${data.round}, Pick ${data.overallPick})` });
        setSelected(null);
        setSearch('');
        searchRef.current?.focus();
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Board grid ────────────────────────────────────────────────────────────
  const sortedTeams = [...teams].sort((a, b) => (a.draft_position ?? 99) - (b.draft_position ?? 99));

  return (
    <div className="space-y-6">

      {/* Current pick banner */}
      <div className="rounded-lg border border-[#2a2a2a] bg-[#111] px-4 py-3 flex items-center gap-3">
        {isDraftDone ? (
          <span className="text-[#f5c518] font-semibold text-lg">Draft complete 🎉</span>
        ) : (
          <>
            <span className="text-[#888] text-sm">Now picking:</span>
            <span className="text-[#f5c518] font-bold text-lg">{currentTeam?.name}</span>
            <span className="text-[#555] text-sm">
              Round {currentPick?.round} · Pick {currentPick?.overall} of {ROUNDS * TEAM_COUNT}
            </span>
          </>
        )}
        <span className="ml-auto text-[#555] text-xs">{picks.length}/{ROUNDS * TEAM_COUNT} picks made</span>
      </div>

      {/* Admin pick panel */}
      {!isDraftDone && (
        <div className="rounded-lg border border-[#2a2a2a] bg-[#111] p-4 space-y-4">
          <div className="text-sm text-[#888] font-semibold uppercase tracking-wide">Make a Pick (Admin)</div>

          {/* PIN entry */}
          {!authed && (
            <div className="flex gap-2 items-center">
              <input
                type="password"
                placeholder="Admin PIN"
                value={pin}
                onChange={e => setPin(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && setAuthed(true)}
                className="bg-[#1a1a1a] border border-[#333] rounded px-3 py-1.5 text-sm text-white w-36 focus:outline-none focus:border-[#f5c518]"
              />
              <button
                onClick={() => setAuthed(true)}
                className="px-3 py-1.5 bg-[#f5c518] text-black text-sm font-semibold rounded hover:bg-yellow-400"
              >
                Unlock
              </button>
              <span className="text-[#555] text-xs">(viewers can watch without a PIN)</span>
            </div>
          )}

          {authed && (
            <div className="space-y-3">
              {/* Position filter */}
              <div className="flex flex-wrap gap-1">
                {['ALL', ...POSITIONS].map(pos => (
                  <button
                    key={pos}
                    onClick={() => setPosFilter(pos)}
                    className={[
                      'px-2 py-0.5 rounded text-xs font-mono transition-colors',
                      posFilter === pos
                        ? 'bg-[#f5c518] text-black font-bold'
                        : takenPositions.has(pos)
                          ? 'bg-[#1a1a1a] text-[#444] line-through cursor-not-allowed'
                          : 'bg-[#1a1a1a] text-[#aaa] hover:bg-[#222]',
                    ].join(' ')}
                  >
                    {pos}
                  </button>
                ))}
              </div>

              {/* Search */}
              <input
                ref={searchRef}
                type="text"
                placeholder="Search player…"
                value={search}
                onChange={e => { setSearch(e.target.value); setSelected(null); }}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#f5c518]"
              />

              {/* Player list */}
              {search.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded border border-[#2a2a2a] bg-[#0d0d0d] divide-y divide-[#1a1a1a]">
                  {filtered.length === 0 && (
                    <div className="px-3 py-2 text-[#555] text-sm">No players found</div>
                  )}
                  {filtered.slice(0, 50).map(p => {
                    const blocked = takenPositions.has(p.position);
                    return (
                      <button
                        key={p.id}
                        disabled={blocked}
                        onClick={() => { setSelected(p); setSearch(p.name); }}
                        className={[
                          'w-full text-left px-3 py-2 text-sm flex justify-between items-center transition-colors',
                          blocked
                            ? 'text-[#444] cursor-not-allowed'
                            : selected?.id === p.id
                              ? 'bg-[#1e1e1e] text-[#f5c518]'
                              : 'text-[#ccc] hover:bg-[#161616]',
                        ].join(' ')}
                      >
                        <span>{p.name}</span>
                        <span className={['font-mono text-xs', blocked ? 'text-[#333]' : 'text-[#666]'].join(' ')}>
                          {p.position}{blocked ? ' ✗' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Confirm button */}
              {selected && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={submitPick}
                    disabled={loading}
                    className="px-4 py-2 bg-[#f5c518] text-black font-bold text-sm rounded hover:bg-yellow-400 disabled:opacity-50"
                  >
                    {loading ? 'Picking…' : `Draft ${selected.name} (${selected.position}) for ${currentTeam?.name}`}
                  </button>
                  <button
                    onClick={() => { setSelected(null); setSearch(''); }}
                    className="text-[#555] text-sm hover:text-[#888]"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {status && (
                <div className={['text-sm px-3 py-2 rounded', status.ok ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'].join(' ')}>
                  {status.msg}
                </div>
              )}

              {/* Re-lock */}
              <button onClick={() => { setAuthed(false); setPin(''); }} className="text-[#444] text-xs hover:text-[#666]">
                Lock admin
              </button>
            </div>
          )}
        </div>
      )}

      {/* Draft board grid */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left px-2 py-1.5 text-[#555] font-normal w-8">#</th>
              {sortedTeams.map(t => (
                <th
                  key={t.id}
                  className={[
                    'px-2 py-1.5 text-center font-semibold whitespace-nowrap',
                    currentTeam?.id === t.id ? 'text-[#f5c518]' : 'text-[#888]',
                  ].join(' ')}
                >
                  {t.name}
                  {currentTeam?.id === t.id && <span className="ml-1">🎯</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {POSITIONS.map(pos => (
              <tr key={pos} className="border-t border-[#1a1a1a]">
                <td className="px-2 py-1.5 text-[#555] font-mono">{pos}</td>
                {sortedTeams.map(t => {
                  const cell = pickMap.get(`${t.id}:${pos}`);
                  return (
                    <td
                      key={t.id}
                      className={[
                        'px-2 py-1.5 text-center whitespace-nowrap',
                        cell ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]',
                      ].join(' ')}
                    >
                      {cell ? (
                        <span title={`Pick #${cell.overall_pick}`}>{cell.players?.name ?? '—'}</span>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pick log */}
      {picks.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-[#555] uppercase tracking-wide font-semibold px-1">Pick log</div>
          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {[...picks].reverse().map(pick => (
              <div key={pick.id} className="flex items-center gap-2 px-2 py-1 rounded bg-[#0d0d0d] text-xs">
                <span className="text-[#444] font-mono w-6 text-right">{pick.overall_pick}</span>
                <span className="text-[#666]">Rd {pick.round}</span>
                <span className="text-[#f5c518] font-semibold">{pick.teams?.name}</span>
                <span className="text-[#888]">→</span>
                <span className="text-[#e8e8e8]">{pick.players?.name}</span>
                <span className="text-[#555] font-mono ml-auto">{pick.players?.position}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
