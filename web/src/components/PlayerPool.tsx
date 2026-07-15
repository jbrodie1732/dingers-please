'use client';

import { useState, useMemo } from 'react';
import InjuryBadge from './InjuryBadge';

export type PoolPlayer = {
  id:            string;
  name:          string;
  position:      string;
  mlb_team:      string | null;
  fantasy_team:  string | null;
  total_hrs:     number;
  preseason_hrs: number;
  il_status:     string | null;
  injury_detail: string | null;
  injury_update: string | null;
};

const POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

type SortKey = 'name' | 'position' | 'mlb_team' | 'preseason_hrs' | 'total_hrs' | 'fantasy_team';
type SortDir = 'asc' | 'desc';

// Numeric columns default to descending (highest first); text columns default
// to ascending (A→Z) the first time you click them.
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name:          'asc',
  position:      'asc',
  mlb_team:      'asc',
  preseason_hrs: 'desc',
  total_hrs:     'desc',
  fantasy_team:  'asc',
};

function SortHeader({
  label, sortKey, activeKey, dir, onClick, className,
}: {
  label:     string;
  sortKey:   SortKey;
  activeKey: SortKey;
  dir:       SortDir;
  onClick:   (key: SortKey) => void;
  className: string;
}) {
  const isActive = activeKey === sortKey;
  return (
    <div
      className={`ptbl-c ${className} ptbl-sort${isActive ? ' is-active' : ''}`}
      onClick={() => onClick(sortKey)}
      role="button"
      tabIndex={0}
    >
      {label}
      {isActive && <span className="ptbl-sort-arrow">{dir === 'asc' ? '▲' : '▼'}</span>}
    </div>
  );
}

export default function PlayerPool({ players }: { players: PoolPlayer[] }) {
  const [search,      setSearch]      = useState('');
  const [posFilter,   setPosFilter]   = useState('ALL');
  const [draftFilter, setDraftFilter] = useState<'all' | 'available' | 'drafted'>('all');
  const [sortKey,      setSortKey]    = useState<SortKey>('preseason_hrs');
  const [sortDir,      setSortDir]    = useState<SortDir>('desc');

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  }

  const filtered = useMemo(() => {
    return players.filter(p => {
      if (posFilter   !== 'ALL'       && p.position     !== posFilter)    return false;
      if (draftFilter === 'available' && p.fantasy_team)                  return false;
      if (draftFilter === 'drafted'   && !p.fantasy_team)                 return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [players, posFilter, draftFilter, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const mul  = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mul;
      const as = (av ?? '').toString().toLowerCase();
      const bs = (bv ?? '').toString().toLowerCase();
      if (as < bs) return -1 * mul;
      if (as > bs) return  1 * mul;
      return 0;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

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
        <div className="pool-scroll">
        <div className="ptbl-row ptbl-head">
          <SortHeader label="PLAYER" sortKey="name"          activeKey={sortKey} dir={sortDir} onClick={handleSort} className="c-name" />
          <SortHeader label="POS"    sortKey="position"      activeKey={sortKey} dir={sortDir} onClick={handleSort} className="c-pos" />
          <SortHeader label="MLB"    sortKey="mlb_team"      activeKey={sortKey} dir={sortDir} onClick={handleSort} className="c-mlb" />
          <SortHeader label="2026 HR" sortKey="preseason_hrs" activeKey={sortKey} dir={sortDir} onClick={handleSort} className="c-preseason-hrs" />
          <SortHeader label="POOL"   sortKey="total_hrs"     activeKey={sortKey} dir={sortDir} onClick={handleSort} className="c-hrs" />
          <SortHeader label="SQUAD"  sortKey="fantasy_team"  activeKey={sortKey} dir={sortDir} onClick={handleSort} className="c-squad" />
        </div>
        {sorted.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--c-textDim)', letterSpacing: '0.1em' }}>
            NO PLAYERS MATCH YOUR FILTERS
          </div>
        ) : sorted.slice(0, 300).map(p => (
          <div key={p.id} className={`ptbl-row${p.fantasy_team ? ' is-drafted' : ''}`}>
            <div className="ptbl-c c-name">
              <span className="pname-text">{p.name}</span>
              <InjuryBadge il_status={p.il_status} injury_detail={p.injury_detail} injury_update={p.injury_update} direction="down" />
            </div>
            <div className="ptbl-c c-pos"><span className="pos-tag">{p.position}</span></div>
            <div className="ptbl-c c-mlb">{p.mlb_team ?? '—'}</div>
            <div className="ptbl-c c-preseason-hrs">{p.preseason_hrs > 0 ? p.preseason_hrs : '—'}</div>
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
      </div>
    </>
  );
}
