'use client';

import { useState, useMemo } from 'react';

type PoolPlayer = {
  id: string;
  name: string;
  position: string;
  mlb_team: string | null;
  fantasy_team: string | null;
};

const POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

export default function PlayerPool({ players }: { players: PoolPlayer[] }) {
  const [search,      setSearch]      = useState('');
  const [posFilter,   setPosFilter]   = useState('ALL');
  const [teamFilter,  setTeamFilter]  = useState('ALL');
  const [draftFilter, setDraftFilter] = useState<'all' | 'available' | 'drafted'>('all');

  const mlbTeams = useMemo(() => {
    const teams = Array.from(new Set(players.map(p => p.mlb_team).filter(Boolean))) as string[];
    return teams.sort();
  }, [players]);

  const filtered = useMemo(() => {
    return players.filter(p => {
      if (posFilter  !== 'ALL' && p.position !== posFilter)  return false;
      if (teamFilter !== 'ALL' && p.mlb_team !== teamFilter) return false;
      if (draftFilter === 'available' && p.fantasy_team)  return false;
      if (draftFilter === 'drafted'   && !p.fantasy_team) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [players, posFilter, teamFilter, draftFilter, search]);

  return (
    // Outer flex column fills the viewport below the navbar
    <div className="flex flex-col" style={{ height: 'calc(100vh - 60px)' }}>

      {/* ── Sticky header + filters ── */}
      <div className="shrink-0 bg-[#0d0d0d] pb-2 space-y-3">
        <h1 className="text-xl font-bold text-[#f5c518]">🗂️ Player Pool</h1>

        <input
          type="text"
          placeholder="Search player…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#f5c518]"
        />

        <div className="flex items-center gap-2">
          {(['all', 'available', 'drafted'] as const).map(f => (
            <button
              key={f}
              onClick={() => setDraftFilter(f)}
              className={[
                'px-3 py-1.5 rounded text-sm transition-colors capitalize',
                draftFilter === f
                  ? 'bg-[#f5c518] text-black font-semibold'
                  : 'bg-[#1a1a1a] text-[#888] hover:text-[#ccc]',
              ].join(' ')}
            >
              {f}
            </button>
          ))}
          <span className="text-[#555] text-xs ml-2">{filtered.length}</span>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-0.5 no-scrollbar">
          {['ALL', ...POSITIONS].map(pos => (
            <button
              key={pos}
              onClick={() => setPosFilter(pos)}
              className={[
                'px-2 py-0.5 rounded text-xs font-mono transition-colors shrink-0',
                posFilter === pos
                  ? 'bg-[#f5c518] text-black font-bold'
                  : 'bg-[#1a1a1a] text-[#888] hover:bg-[#222] hover:text-[#ccc]',
              ].join(' ')}
            >
              {pos}
            </button>
          ))}
        </div>

        <div className="flex justify-center items-center gap-2">
          <span className="text-[#555] text-xs">MLB Team:</span>
          <select
            value={teamFilter}
            onChange={e => setTeamFilter(e.target.value)}
            className="bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#f5c518]"
          >
            <option value="ALL">All</option>
            {mlbTeams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* ── Scrollable table ── */}
      <div className="overflow-y-auto flex-1 overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-[#0d0d0d]">
            <tr className="border-b border-[#2a2a2a]">
              <th className="text-left px-3 py-2 text-[#555] font-normal">Player</th>
              <th className="text-left px-3 py-2 text-[#555] font-normal w-16">Pos</th>
              <th className="text-left px-3 py-2 text-[#555] font-normal w-16">Team</th>
              <th className="text-left px-3 py-2 text-[#555] font-normal">Squad</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-[#555] text-center">No players match your filters</td>
              </tr>
            )}
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-[#111] hover:bg-[#111]">
                <td className="px-3 py-2 text-[#e8e8e8]">{p.name}</td>
                <td className="px-3 py-2 text-[#888] font-mono">{p.position}</td>
                <td className="px-3 py-2 text-[#888] font-mono">{p.mlb_team ?? '—'}</td>
                <td className="px-3 py-2">
                  {p.fantasy_team
                    ? <span className="text-[#f5c518] text-xs font-semibold">{p.fantasy_team}</span>
                    : <span className="text-[#333] text-xs">—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
