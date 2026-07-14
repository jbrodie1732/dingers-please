// standings.jsx — home page: standings table + bar race + live HR feed

const { useState: useS_st, useEffect: useE_st, useMemo: useM_st } = React;

function StandingsScreen({ standings, hrFeed, pulseTeamId, onSimulate }) {
  const leader = standings[0];
  const totalHrs = standings.reduce((a, b) => a + b.hrs, 0);
  const max = Math.max(...standings.map(s => s.hrs), 1);

  return (
    <div className="screen screen-standings">
      <div className="hero-header">
        <div className="hero-eyebrow">SEASON 2026 · DAY 32 OF 79</div>
        <h1 className="hero-title">STANDINGS</h1>
        <div className="hero-meta">
          <span><b>{totalHrs}</b> dingers logged</span>
          <span className="dot-sep">·</span>
          <span><b>{hrFeed.length}</b> in feed</span>
          <span className="dot-sep">·</span>
          <span>Updated <b>just now</b></span>
        </div>
      </div>

      <div className="standings-grid">
        <section className="card card-board">
          <div className="card-head">
            <div className="card-head-l">
              <h2 className="card-title">League Board</h2>
              <span className="card-sub">15 teams · 9 rounds drafted</span>
            </div>
            <div className="card-head-r">
              <button className="btn-ghost" onClick={onSimulate}>SIMULATE HR</button>
            </div>
          </div>
          <div className="board-table">
            <div className="board-row board-head">
              <div className="bcol bcol-rank">#</div>
              <div className="bcol bcol-team">TEAM · OWNER</div>
              <div className="bcol bcol-bar">PACE</div>
              <div className="bcol bcol-num">HR</div>
              <div className="bcol bcol-gap">GB</div>
            </div>
            {standings.map((t, i) => {
              const gap = leader.hrs - t.hrs;
              const pct = t.hrs / max;
              const isPulse = pulseTeamId === t.id;
              return (
                <div key={t.id} className={`board-row${i === 0 ? ' is-leader' : ''}${isPulse ? ' is-pulse' : ''}`}
                     style={{ '--team': t.color }}>
                  <div className="bcol bcol-rank">
                    <span className="rank-num">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <div className="bcol bcol-team">
                    <span className="team-chip" style={{ background: t.color }} />
                    <div className="team-stack">
                      <div className="team-name">{t.name}</div>
                      <div className="team-owner">{t.owner}</div>
                    </div>
                  </div>
                  <div className="bcol bcol-bar">
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: (pct * 100) + '%', background: t.color }} />
                      {i === 0 && <div className="bar-leader-tag">LEADER</div>}
                    </div>
                  </div>
                  <div className="bcol bcol-num">
                    <span className="num-big">{t.hrs}</span>
                  </div>
                  <div className="bcol bcol-gap">
                    {gap === 0 ? <span className="gap-leader">—</span> : <span className="gap-num">-{gap}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card card-feed">
          <div className="card-head">
            <h2 className="card-title">Live Feed</h2>
            <span className="livepill livepill-sm">
              <span className="livedot" />
              <span>LIVE</span>
            </span>
          </div>
          <div className="feed-list">
            {hrFeed.slice(0, 12).map((hr, i) => (
              <FeedRow key={hr.id} hr={hr} fresh={i === 0 && hr.isFresh} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function FeedRow({ hr, fresh }) {
  const ago = hr.minutesAgo === 0 ? 'just now' :
              hr.minutesAgo < 60 ? hr.minutesAgo + 'm ago' :
              Math.floor(hr.minutesAgo / 60) + 'h ago';
  return (
    <div className={`feed-row${fresh ? ' is-fresh' : ''}`} style={{ '--team': hr.teamColor }}>
      <div className="feed-bar" />
      <div className="feed-main">
        <div className="feed-row1">
          <span className="feed-name">{hr.player.name}</span>
          <span className="feed-pos">{hr.player.pos}</span>
          <span className="feed-ago">{ago}</span>
        </div>
        <div className="feed-row2">
          <span className="feed-team">{hr.team.name}</span>
          <span className="feed-divider">·</span>
          <span className="feed-dist">{hr.distance} ft</span>
          <span className="feed-divider">·</span>
          <span className="feed-ev">{hr.exitVelo} mph</span>
          <span className={`feed-mickey ${hr.mickeyLabel === 'LEGIT' ? 'is-legit' : 'is-mouse'}`}>
            {hr.mickeyLabel === 'LEGIT' ? `LEGIT ${hr.mickeyMeter}/30` : `MICKEY ${hr.mickeyMeter}/30`}
          </span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { StandingsScreen, FeedRow });
