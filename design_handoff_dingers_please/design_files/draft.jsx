// draft.jsx — snake board, on the clock, search/pick

const { useState: uSd, useMemo: uMd, useRef: uRd } = React;

function DraftScreen({ draftPicks, setDraftPicks }) {
  const [search, setSearch] = uSd('');
  const [posFilter, setPosFilter] = uSd('ALL');
  const [selected, setSelected] = uSd(null);
  const [authed, setAuthed] = uSd(false);
  const [pinInput, setPin] = uSd('');
  const [pinError, setPinError] = uSd('');
  const inputRef = uRd(null);

  const ROUNDS = 9;
  const totalPicks = window.TEAMS.length * ROUNDS;
  const currentIdx = draftPicks.length;
  const isDone = currentIdx >= totalPicks;

  // Compute next pick slot
  function pickSlot(idx) {
    const r = Math.floor(idx / window.TEAMS.length) + 1;
    const inRound = idx % window.TEAMS.length;
    const snake = r % 2 === 0;
    const teamIdx = snake ? window.TEAMS.length - 1 - inRound : inRound;
    return { round: r, pickInRound: inRound + 1, teamIdx };
  }
  const next = isDone ? null : pickSlot(currentIdx);
  const onClock = next ? window.TEAMS[next.teamIdx] : null;
  const onClockColor = next ? window.TEAM_COLORS[next.teamIdx] : null;

  // Picked map: teamIdx:pos -> pick
  const pickMap = uMd(() => {
    const m = new Map();
    for (const p of draftPicks) {
      m.set(`${p.teamIdx}:${p.player.pos}`, p);
    }
    return m;
  }, [draftPicks]);

  // Available players
  const teamTakenPos = new Set(
    onClock ? draftPicks.filter(p => p.teamIdx === next.teamIdx).map(p => p.player.pos) : []
  );
  const draftedIds = new Set(draftPicks.map(p => p.player.id));
  const available = window.PLAYERS.filter(p => !draftedIds.has(p.id));
  const filtered = available.filter(p => {
    if (posFilter !== 'ALL' && p.pos !== posFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => a.tier - b.tier);

  function tryUnlock() {
    if (pinInput === '0824' || pinInput === '1234' || pinInput.length >= 3) {
      setAuthed(true); setPinError('');
    } else {
      setPinError('Try 1234 (demo)');
    }
  }

  function makePick() {
    if (!selected || !next) return;
    const newPick = {
      overall: currentIdx + 1,
      round: next.round,
      pickInRound: next.pickInRound,
      teamId: onClock.id,
      teamName: onClock.name,
      teamIdx: next.teamIdx,
      player: { ...selected, fantasy_team: onClock.name },
      _new: true,
    };
    setDraftPicks(prev => [...prev, newPick]);
    setSelected(null); setSearch('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div className="screen screen-draft">
      <div className="hero-header">
        <div className="hero-eyebrow">2026 SNAKE DRAFT · 9 ROUNDS · 15 TEAMS</div>
        <h1 className="hero-title">DRAFT ROOM</h1>
      </div>

      {/* On the clock */}
      <div className={`onclock${isDone ? ' is-done' : ''}`} style={{ '--team': onClockColor }}>
        {isDone ? (
          <div className="onclock-done">
            <div className="onclock-eyebrow">DRAFT COMPLETE</div>
            <div className="onclock-name">All {totalPicks} picks made</div>
          </div>
        ) : (
          <>
            <div className="onclock-l">
              <div className="onclock-eyebrow">ON THE CLOCK</div>
              <div className="onclock-name">{onClock.name}</div>
              <div className="onclock-owner">{onClock.owner}</div>
            </div>
            <div className="onclock-m">
              <div className="onclock-pickbig">
                <div className="onclock-num">#{currentIdx + 1}</div>
                <div className="onclock-of">/ {totalPicks}</div>
              </div>
              <div className="onclock-rd">RD {next.round} · PICK {next.pickInRound}</div>
            </div>
            <div className="onclock-r">
              <div className="onclock-clock">
                <div className="clock-num">01:24</div>
                <div className="clock-lbl">PICK CLOCK</div>
              </div>
            </div>
          </>
        )}
      </div>

      {!isDone && (
        <div className="card draft-pick">
          {!authed ? (
            <div className="pin-row">
              <div className="pin-eyebrow">COMMISSIONER PIN</div>
              <div className="pin-fields">
                <input type="password" placeholder="••••" value={pinInput}
                       onChange={e => { setPin(e.target.value); setPinError(''); }}
                       onKeyDown={e => e.key === 'Enter' && tryUnlock()}
                       className="pin-input"/>
                <button className="btn-primary" onClick={tryUnlock}>Unlock</button>
                <span className={`pin-msg${pinError ? ' is-err' : ''}`}>{pinError || 'Viewers can watch without a PIN · try 1234'}</span>
              </div>
            </div>
          ) : (
            <div className="pick-flow">
              <div className="pick-row">
                <input ref={inputRef} className="pick-search" placeholder="Search batter to draft…"
                       value={search} onChange={e => { setSearch(e.target.value); setSelected(null); }}/>
                <div className="pick-pos-filters">
                  {['ALL', ...window.POSITIONS].map(p => {
                    const blocked = teamTakenPos.has(p);
                    return (
                      <button key={p}
                              className={`posbtn${posFilter === p ? ' is-on' : ''}${blocked ? ' is-blocked' : ''}`}
                              onClick={() => !blocked && setPosFilter(p)} disabled={blocked}>{p}</button>
                    );
                  })}
                </div>
              </div>
              {search.length > 0 && (
                <div className="pick-list">
                  {filtered.slice(0, 12).map(p => {
                    const blocked = teamTakenPos.has(p.pos);
                    return (
                      <button key={p.id} className={`pick-item${selected?.id === p.id ? ' is-sel' : ''}${blocked ? ' is-blocked' : ''}`}
                              onClick={() => !blocked && setSelected(p)} disabled={blocked}>
                        <span className="pi-name">{p.name}</span>
                        <span className="pi-mlb">{p.mlb}</span>
                        <span className="pi-pos">{p.pos}</span>
                        <TierDots tier={p.tier} />
                      </button>
                    );
                  })}
                </div>
              )}
              {selected && (
                <div className="pick-confirm">
                  <button className="btn-primary btn-big" onClick={makePick}>
                    DRAFT {selected.name} ({selected.pos}) → {onClock.name}
                  </button>
                  <button className="btn-ghost" onClick={() => { setSelected(null); setSearch(''); }}>Cancel</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Snake board */}
      <div className="card draft-board-card">
        <div className="card-head">
          <h2 className="card-title">Snake Board</h2>
          <span className="card-sub">{draftPicks.length} of {totalPicks} picks</span>
        </div>
        <div className="snake-scroll">
          <table className="snake">
            <thead>
              <tr>
                <th className="snake-pos-head">POS</th>
                {window.TEAMS.map((t, i) => (
                  <th key={t.id} className={`snake-team${onClock?.id === t.id ? ' is-on' : ''}`}
                      style={{ '--team': window.TEAM_COLORS[i] }}>
                    <div className="snake-team-rank">{i + 1}</div>
                    <div className="snake-team-name">{t.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {window.POSITIONS.map(pos => (
                <tr key={pos}>
                  <td className="snake-pos">{pos}</td>
                  {window.TEAMS.map((t, ti) => {
                    const p = pickMap.get(`${ti}:${pos}`);
                    const isCurrent = onClock?.id === t.id && !p;
                    return (
                      <td key={t.id} className={`snake-cell${p ? ' has-pick' : ''}${isCurrent ? ' is-current' : ''}${p?._new ? ' is-new' : ''}`}>
                        {p ? (
                          <div className="cell-pick">
                            <div className="cell-name">{p.player.name}</div>
                            <div className="cell-mlb">{p.player.mlb}</div>
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

      {/* Pick log */}
      {draftPicks.length > 0 && (
        <div className="card pick-log">
          <div className="card-head"><h2 className="card-title">Pick Log</h2></div>
          <div className="log-rows">
            {[...draftPicks].reverse().slice(0, 30).map(p => (
              <div key={p.overall} className="log-row" style={{ '--team': window.TEAM_COLORS[p.teamIdx] }}>
                <span className="log-num">#{String(p.overall).padStart(3, '0')}</span>
                <span className="log-rd">RD{p.round}.{p.pickInRound}</span>
                <span className="log-team">{p.teamName}</span>
                <span className="log-arrow">→</span>
                <span className="log-player">{p.player.name}</span>
                <span className="log-pos">{p.player.pos}</span>
                <span className="log-mlb">{p.player.mlb}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { DraftScreen });
