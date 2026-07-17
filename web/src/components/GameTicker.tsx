'use client';

import { useEffect, useState } from 'react';
import { getTeamColor } from '@/lib/types';

type TeamSide = { abbr: string; name: string; score: number | null; record: string | null };
type Rostered = {
  name: string;
  pos: string;
  mlbTeam: string;
  squad: string;
  draftPosition: number | null;
  side: 'away' | 'home';
};
type TickerGame = {
  gamePk: number;
  state: 'live' | 'pre' | 'final';
  detailed: string;
  startsAt: string | null;
  away: TeamSide;
  home: TeamSide;
  inning: number | null;
  inningState: string | null;
  inningOrdinal: string | null;
  outs: number | null;
  rostered: Rostered[];
};

function startTime(iso: string | null): string {
  if (!iso) return 'TBD';
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return 'TBD';
  }
}

function StatusChip({ g }: { g: TickerGame }) {
  if (g.state === 'live') {
    const half = g.inningState ? `${g.inningState} ${g.inningOrdinal ?? g.inning ?? ''}`.trim() : 'Live';
    return (
      <span className="tk-status is-live">
        <span className="tk-livedot" />
        {half}
      </span>
    );
  }
  if (g.state === 'final') {
    return <span className="tk-status is-final">{g.detailed?.startsWith('Final') ? g.detailed : 'Final'}</span>;
  }
  return <span className="tk-status is-pre">{startTime(g.startsAt)}</span>;
}

function TeamRow({ t, winner }: { t: TeamSide; winner: boolean }) {
  return (
    <div className={`tk-team${winner ? ' is-winner' : ''}`}>
      <span className="tk-abbr">{t.abbr}</span>
      {t.record && <span className="tk-rec">{t.record}</span>}
      <span className="tk-score">{t.score ?? ''}</span>
    </div>
  );
}

function GameCard({
  g,
  selected,
  onToggle,
}: {
  g: TickerGame;
  selected: boolean;
  onToggle: () => void;
}) {
  const decided = g.state === 'final' && g.away.score != null && g.home.score != null;
  const awayWon = decided && (g.away.score as number) > (g.home.score as number);
  const homeWon = decided && (g.home.score as number) > (g.away.score as number);
  const n = g.rostered.length;
  const interactive = n > 0;

  return (
    <div
      className={`tk-card is-${g.state}${selected ? ' is-selected' : ''}${interactive ? ' is-clickable' : ''}`}
      onClick={interactive ? onToggle : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } } : undefined}
      aria-expanded={interactive ? selected : undefined}
    >
      <div className="tk-card-head">
        <StatusChip g={g} />
        {g.state === 'live' && g.outs != null && (
          <span className="tk-outs">{g.outs} out{g.outs === 1 ? '' : 's'}</span>
        )}
      </div>
      <TeamRow t={g.away} winner={awayWon} />
      <TeamRow t={g.home} winner={homeWon} />
      <div className={`tk-pool${n > 0 ? '' : ' is-none'}`}>
        {n > 0 ? (
          <>
            <span className="tk-pool-dot" />
            {n} player{n === 1 ? '' : 's'}
            <span className="tk-pool-caret">{selected ? '▾' : '▸'}</span>
          </>
        ) : 'no rostered players'}
      </div>
    </div>
  );
}

function DetailPanel({ g }: { g: TickerGame }) {
  const bySide = (side: 'away' | 'home') => g.rostered.filter((r) => r.side === side);
  const sides: { side: 'away' | 'home'; team: TeamSide }[] = [
    { side: 'away', team: g.away },
    { side: 'home', team: g.home },
  ];

  return (
    <div className="ticker-detail">
      <div className="ticker-detail-head">
        Rostered players · {g.away.abbr} @ {g.home.abbr}
      </div>
      <div className="ticker-detail-cols">
        {sides.map(({ side, team }) => {
          const players = bySide(side);
          return (
            <div className="ticker-detail-col" key={side}>
              <div className="ticker-detail-team">{team.abbr}</div>
              {players.length === 0 ? (
                <div className="ticker-detail-none">—</div>
              ) : (
                players.map((p) => (
                  <div className="ticker-detail-row" key={`${p.name}-${p.squad}`}>
                    <span
                      className="ticker-detail-swatch"
                      style={{ background: getTeamColor(p.squad, p.draftPosition) }}
                    />
                    <span className="ticker-detail-name">{p.name}</span>
                    <span className="ticker-detail-pos">{p.pos}</span>
                    <span className="ticker-detail-squad">{p.squad}</span>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function GameTicker() {
  const [games, setGames] = useState<TickerGame[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedPk, setSelectedPk] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const res = await fetch('/api/schedule', { cache: 'no-store' });
        const data = await res.json();
        if (!alive) return;
        setGames(data.games ?? []);
        setFailed(false);
      } catch {
        if (!alive) return;
        setFailed(true);
      }
    }

    load();
    const id = setInterval(load, 45_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const liveCount = games?.filter((g) => g.state === 'live').length ?? 0;
  const selected = games?.find((g) => g.gamePk === selectedPk && g.rostered.length > 0) ?? null;

  return (
    <section className="ticker card">
      <div className="ticker-head">
        <h2 className="ticker-title">Today&apos;s Slate</h2>
        {liveCount > 0 && (
          <span className="ticker-livecount">
            <span className="tk-livedot" />
            {liveCount} live
          </span>
        )}
      </div>

      {games === null && !failed && <div className="ticker-empty">Loading games…</div>}
      {failed && <div className="ticker-empty">Couldn&apos;t load today&apos;s games.</div>}
      {games !== null && games.length === 0 && <div className="ticker-empty">No games on the slate today.</div>}

      {games !== null && games.length > 0 && (
        <div className="ticker-rail">
          {games.map((g) => (
            <GameCard
              key={g.gamePk}
              g={g}
              selected={selectedPk === g.gamePk}
              onToggle={() => setSelectedPk((cur) => (cur === g.gamePk ? null : g.gamePk))}
            />
          ))}
        </div>
      )}

      {selected && <DetailPanel g={selected} />}
    </section>
  );
}
