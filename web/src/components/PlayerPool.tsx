'use client';

import { useState, useMemo } from 'react';

export type PoolPlayer = {
  id:           string;
  name:         string;
  position:     string;
  mlb_team:     string | null;
  fantasy_team: string | null;
  total_hrs:    number;
};

const POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

function getTier(hrs: number): number {
  if (hrs >= 5) return 1;
  if (hrs >= 3) return 2;
  if (hrs >= 2) return 3;
  if (hrs >= 1) return 4;
  return 5;
}

function TierDots({ tier }: { tier: number }) {
  return (
    <span className="tier-dots">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`tdot${i <= (6 - tier) ? ' is-on' : ''}`} />
      ))}
    </span>
  );
}

export default function PlayerPool({ players }: { players: PoolPlayer[] }) {
  const [search,      setSearch]      = useState('');
  const [posFilter,   setPosFilter]   = useState('ALL');
  const [draftFilter, setDraftFilter] = useState<'all' | 'available' | 'drafted'>('all');

  const filtered = useMemo(() => {
    return players.filter(p => {
      if (posFilter   !== 'ALL'       && p.position     !== posFilter)    return false;
      if (draftFilter === 'available' && p.fantasy_team)                  return false;
      if (draftFilter === 'drafted'   && !p.fantasy_team)                 return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [players, posFilter, draftFilter, search]);

  return (
    <>
      <div className="pool-controls">
        <input
          className="pool-search"
          placeholder="Search batter…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="seg">
            {(['all', 'available', 'drafted'] as const).map(s => (
              <button key={s} className={`seg-btn${draftFilter === s ? ' is-on' : ''}`} onClick={() => setDraftFilter(s)}>
                {s}
              </button>
            ))}
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--c-textDim)' }}>
            {filtered.length} players
          </span>
        </div>
        <div className="pos-filters">
          {['ALL', ...POSITIONS].map(pos => (
            <button key={pos} className={`posbtn${posFilter === pos ? ' is-on' : ''}`} onClick={() => setPosFilter(pos)}>
              {pos}
            </button>
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
        {filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--c-textDim)', letterSpacing: '0.1em' }}>
            NO PLAYERS MATCH YOUR FILTERS
          </div>
        ) : filtered.slice(0, 300).map(p => (
          <div key={p.id} className={`ptbl-row${p.fantasy_team ? ' is-drafted' : ''}`}>
            <div className="ptbl-c c-name">{p.name}</div>
            <div className="ptbl-c c-pos"><span className="pos-tag">{p.position}</span></div>
            <div className="ptbl-c c-mlb">{p.mlb_team ?? '—'}</div>
            <div className="ptbl-c c-tier"><TierDots tier={getTier(p.total_hrs)} /></div>
            <div className="ptbl-c c-hrs">{p.total_hrs > 0 ? p.total_hrs : '—'}</div>
            <div className="ptbl-c c-squad">
              {p.fantasy_team
                ? <span className="squad-on">{p.fantasy_team}</span>
                : <span className="squad-off">undrafted</span>
              }
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
