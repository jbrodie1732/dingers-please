// admin.jsx — Admin panel: PIN gate, add/drop, season config, manual HR, danger zone

const { useState: aS, useEffect: aE, useMemo: aM } = React;

const ADMIN_PIN = '4242'; // mock — real app uses /api/admin

function AdminScreen({ onClose, standings, simulateHR }) {
  const [authed, setAuthed] = aS(false);
  const [pin, setPin] = aS('');
  const [pinErr, setPinErr] = aS('');
  const [tab, setTab] = aS('addrop');
  const [status, setStatus] = aS(null);

  // Mock budget: each team gets 2 add/drops per season
  const [budgets, setBudgets] = aS(() =>
    Object.fromEntries(window.TEAMS.map(t => [t.id, { used: t.id === 't3' ? 1 : t.id === 't7' ? 2 : 0, limit: 2 }]))
  );
  const [addDropLimit, setAddDropLimit] = aS(2);
  const [transactions, setTransactions] = aS([
    { id: 'tx1', date: 'Aug 4', team: 'Mickey Mouse Park', dropped: { name: 'Yoan Moncada', pos: '3B' }, added: { name: 'Royce Lewis' }, notes: 'Injury IL' },
    { id: 'tx2', date: 'Aug 11', team: 'Foul Pole Posse', dropped: { name: 'Jose Siri', pos: 'CF' }, added: { name: 'Brenton Doyle' }, notes: '' },
    { id: 'tx3', date: 'Aug 18', team: 'Foul Pole Posse', dropped: { name: 'Tyler O\u2019Neill', pos: 'RF' }, added: { name: 'Wilyer Abreu' }, notes: 'Slumping' },
  ]);

  function tryUnlock() {
    if (!pin) { setPinErr('Enter your PIN'); return; }
    if (pin === ADMIN_PIN) {
      setAuthed(true);
      setPinErr('');
    } else {
      setPinErr('Invalid PIN');
    }
  }

  function notify(ok, msg) {
    setStatus({ ok, msg });
    setTimeout(() => setStatus(null), 4000);
  }

  if (!authed) {
    return (
      <div className="admin-overlay">
        <div className="admin-pin-card">
          <button className="admin-close" onClick={onClose} aria-label="Close">×</button>
          <div className="admin-pin-glyph">
            <svg viewBox="0 0 32 32" width="32" height="32">
              <rect x="6" y="14" width="20" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M11 14 V 10 a 5 5 0 0 1 10 0 V 14" fill="none" stroke="currentColor" strokeWidth="1.6"/>
              <circle cx="16" cy="20" r="2" fill="currentColor"/>
              <line x1="16" y1="22" x2="16" y2="25" stroke="currentColor" strokeWidth="1.6"/>
            </svg>
          </div>
          <div className="admin-pin-eyebrow">COMMISSIONER ACCESS</div>
          <h2 className="admin-pin-title">Enter PIN</h2>
          <p className="admin-pin-hint">Mock PIN: <code>4242</code></p>
          <div className="admin-pin-input">
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={e => { setPin(e.target.value); setPinErr(''); }}
              onKeyDown={e => e.key === 'Enter' && tryUnlock()}
              autoFocus
              placeholder="••••"
              className={pinErr ? 'has-err' : ''}
            />
            <button className="admin-pin-btn" onClick={tryUnlock}>Unlock</button>
          </div>
          {pinErr && <div className="admin-pin-err">{pinErr}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-overlay">
      <div className="admin-shell">
        <div className="admin-shell-head">
          <div>
            <div className="admin-eyebrow">COMMISSIONER · UNLOCKED</div>
            <h2 className="admin-title">Admin Panel</h2>
          </div>
          <button className="admin-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="admin-tabs">
          {[
            { id: 'addrop',  label: 'Add / Drop', glyph: '⇄' },
            { id: 'hr',      label: 'Manual HR',  glyph: '◎' },
            { id: 'config',  label: 'Season',     glyph: '⚙' },
            { id: 'history', label: 'History',    glyph: '☰' },
            { id: 'danger',  label: 'Danger',     glyph: '⚠' },
          ].map(t => (
            <button key={t.id} className={`atab${tab === t.id ? ' is-on' : ''}${t.id === 'danger' ? ' is-danger' : ''}`}
                    onClick={() => setTab(t.id)}>
              <span className="atab-glyph">{t.glyph}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {status && (
          <div className={`admin-status ${status.ok ? 'is-ok' : 'is-err'}`}>
            <span>{status.ok ? '✓' : '✕'}</span> {status.msg}
          </div>
        )}

        <div className="admin-body">
          {tab === 'addrop'  && <AddDropTab budgets={budgets} setBudgets={setBudgets}
                                             transactions={transactions} setTransactions={setTransactions}
                                             notify={notify} standings={standings} />}
          {tab === 'hr'      && <ManualHRTab simulateHR={simulateHR} notify={notify} standings={standings} />}
          {tab === 'config'  && <ConfigTab addDropLimit={addDropLimit} setAddDropLimit={setAddDropLimit}
                                            budgets={budgets} setBudgets={setBudgets} notify={notify} />}
          {tab === 'history' && <HistoryTab transactions={transactions} />}
          {tab === 'danger'  && <DangerTab notify={notify} pin={ADMIN_PIN} />}
        </div>

        <div className="admin-foot">
          <button className="admin-lock-btn" onClick={() => { setAuthed(false); setPin(''); }}>
            <svg viewBox="0 0 16 16" width="12" height="12"><rect x="3" y="7" width="10" height="7" rx="1" fill="currentColor"/><path d="M5.5 7 V 5 a 2.5 2.5 0 0 1 5 0 V 7" fill="none" stroke="currentColor" strokeWidth="1.4"/></svg>
            Lock admin
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add / Drop ─────────────────────────────────────────────────────────────
function AddDropTab({ budgets, setBudgets, transactions, setTransactions, notify, standings }) {
  const [teamId, setTeamId] = aS(null);
  const [dropPlayer, setDropPlayer] = aS(null);
  const [addName, setAddName] = aS('');
  const [notes, setNotes] = aS('');
  const [submitting, setSubmitting] = aS(false);

  const team = teamId ? standings.find(t => t.id === teamId) : null;
  const teamIdx = team ? window.TEAMS.findIndex(t => t.id === team.id) : -1;
  const roster = teamIdx >= 0 ? window.POSITIONS.map(pos => window.TEAM_ROSTERS[teamIdx][pos]).filter(Boolean) : [];
  const budget = team ? budgets[team.id] : null;
  const exhausted = budget && budget.used >= budget.limit;

  function submit() {
    if (!team || !dropPlayer || !addName.trim()) return;
    setSubmitting(true);
    setTimeout(() => {
      // mock: add transaction, increment budget
      setTransactions(prev => [{
        id: 'tx_' + Date.now(),
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        team: team.name,
        dropped: { name: dropPlayer.name, pos: dropPlayer.pos },
        added: { name: addName.trim() },
        notes: notes.trim(),
      }, ...prev]);
      setBudgets(prev => ({ ...prev, [team.id]: { ...prev[team.id], used: prev[team.id].used + 1 } }));
      notify(true, `${dropPlayer.name} → ${addName.trim()} processed.`);
      setDropPlayer(null); setAddName(''); setNotes(''); setTeamId(null);
      setSubmitting(false);
    }, 500);
  }

  return (
    <div className="addrop">
      <div className="addrop-step">
        <div className="addrop-step-head"><span className="step-num">1</span> Pick a team</div>
        <div className="addrop-teams">
          {standings.map(t => {
            const b = budgets[t.id];
            const out = b.used >= b.limit;
            const isOn = teamId === t.id;
            return (
              <button key={t.id}
                      className={`addrop-team${isOn ? ' is-on' : ''}${out ? ' is-out' : ''}`}
                      style={isOn ? { borderColor: t.color, boxShadow: `0 0 0 2px ${t.color}33` } : {}}
                      disabled={out}
                      onClick={() => { setTeamId(t.id); setDropPlayer(null); setAddName(''); }}>
                <span className="addrop-team-dot" style={{ background: t.color }} />
                <span className="addrop-team-name">{t.name}</span>
                <span className="addrop-team-budget">{b.limit - b.used}/{b.limit}</span>
              </button>
            );
          })}
        </div>
      </div>

      {team && !exhausted && (
        <div className="addrop-step">
          <div className="addrop-step-head"><span className="step-num">2</span> Drop a player</div>
          <div className="addrop-roster">
            {roster.map(p => (
              <button key={p.id}
                      className={`addrop-rost${dropPlayer?.id === p.id ? ' is-on' : ''}`}
                      onClick={() => setDropPlayer(p)}>
                <span className="addrop-rost-pos">{p.pos}</span>
                <span className="addrop-rost-name">{p.name}</span>
                <span className="addrop-rost-mlb">{p.mlb}</span>
                <span className="addrop-rost-hrs">{p.hrs} HR</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {team && dropPlayer && (
        <div className="addrop-step">
          <div className="addrop-step-head">
            <span className="step-num">3</span> Add a {dropPlayer.pos}
            <span className="addrop-step-sub">replacing {dropPlayer.name}</span>
          </div>
          <div className="addrop-form">
            <label className="addrop-field">
              <div className="addrop-field-lbl">Player name</div>
              <input className="addrop-input" placeholder="Full MLB name" value={addName}
                     onChange={e => setAddName(e.target.value)} autoFocus />
            </label>
            <label className="addrop-field">
              <div className="addrop-field-lbl">Notes (optional)</div>
              <input className="addrop-input" placeholder="Injury, slump, etc." value={notes}
                     onChange={e => setNotes(e.target.value)} />
            </label>
            <button className="addrop-submit" onClick={submit} disabled={!addName.trim() || submitting}
                    style={{ background: team.color }}>
              {submitting ? 'Processing…' : (
                <>Drop <b>{dropPlayer.name}</b> → Add <b>{addName || '?'}</b></>
              )}
            </button>
          </div>
        </div>
      )}

      {team && exhausted && (
        <div className="addrop-exhausted">
          <span>{team.name} has used all {budget.limit} add/drops this season.</span>
        </div>
      )}
    </div>
  );
}

// ─── Manual HR entry ─────────────────────────────────────────────────────────
function ManualHRTab({ simulateHR, notify, standings }) {
  const [playerName, setPlayerName] = aS('');
  const [teamId, setTeamId] = aS(standings[0]?.id || '');
  const [distance, setDistance] = aS(420);
  const [exitVelo, setExitVelo] = aS(105);
  const [launchAngle, setLaunchAngle] = aS(28);
  const [inning, setInning] = aS('B5');

  function submit() {
    if (!playerName.trim()) return;
    notify(true, `Manual HR logged: ${playerName} · ${distance} ft. SMS sent to group chat.`);
    setPlayerName('');
  }

  return (
    <div className="manual-hr">
      <div className="manual-hr-blurb">
        Use this to log a HR that the data feed missed, or correct an existing entry.
        This will fire the celebration toast on every connected screen and send the SMS alert.
      </div>
      <div className="manual-hr-form">
        <div className="mhr-row">
          <label className="mhr-field mhr-field-grow">
            <div className="mhr-lbl">Player</div>
            <input className="mhr-input" placeholder="Aaron Judge" value={playerName}
                   onChange={e => setPlayerName(e.target.value)} />
          </label>
          <label className="mhr-field">
            <div className="mhr-lbl">Team</div>
            <select className="mhr-input" value={teamId} onChange={e => setTeamId(e.target.value)}>
              {standings.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        </div>
        <div className="mhr-row">
          <label className="mhr-field">
            <div className="mhr-lbl">Distance (ft)</div>
            <input className="mhr-input" type="number" value={distance}
                   onChange={e => setDistance(parseInt(e.target.value) || 0)} />
          </label>
          <label className="mhr-field">
            <div className="mhr-lbl">Exit Velo (mph)</div>
            <input className="mhr-input" type="number" step="0.1" value={exitVelo}
                   onChange={e => setExitVelo(parseFloat(e.target.value) || 0)} />
          </label>
          <label className="mhr-field">
            <div className="mhr-lbl">Launch Angle (°)</div>
            <input className="mhr-input" type="number" value={launchAngle}
                   onChange={e => setLaunchAngle(parseInt(e.target.value) || 0)} />
          </label>
          <label className="mhr-field">
            <div className="mhr-lbl">Inning</div>
            <input className="mhr-input" value={inning} onChange={e => setInning(e.target.value)} />
          </label>
        </div>
        <div className="mhr-row mhr-actions">
          <button className="mhr-submit" onClick={submit} disabled={!playerName.trim()}>
            Log HR + Send SMS
          </button>
          <button className="mhr-test" onClick={() => { simulateHR(); notify(true, 'Test celebration fired.'); }}>
            Fire test celebration
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Season config ───────────────────────────────────────────────────────────
function ConfigTab({ addDropLimit, setAddDropLimit, budgets, setBudgets, notify }) {
  const [draft, setDraft] = aS(addDropLimit);
  function save() {
    setAddDropLimit(draft);
    setBudgets(prev => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, limit: draft }])));
    notify(true, `Add/drop limit set to ${draft} per team.`);
  }
  return (
    <div className="config-tab">
      <div className="config-card">
        <div className="config-card-eyebrow">SEASON RULE</div>
        <div className="config-card-title">Add/drop limit per team</div>
        <div className="config-card-row">
          <button className="config-step" onClick={() => setDraft(Math.max(0, draft - 1))}>−</button>
          <div className="config-num">{draft}</div>
          <button className="config-step" onClick={() => setDraft(draft + 1)}>+</button>
          <div className="config-num-lbl">moves / season</div>
        </div>
        <button className="config-save" onClick={save} disabled={draft === addDropLimit}>
          Save change
        </button>
        <div className="config-foot">Currently: <b>{addDropLimit}</b> moves per team</div>
      </div>
    </div>
  );
}

// ─── History ─────────────────────────────────────────────────────────────────
function HistoryTab({ transactions }) {
  if (transactions.length === 0) {
    return <div className="history-empty">No transactions yet this season.</div>;
  }
  return (
    <div className="history">
      {transactions.map(tx => (
        <div key={tx.id} className="history-row">
          <span className="history-date">{tx.date}</span>
          <span className="history-team">{tx.team}</span>
          <div className="history-move">
            <span className="history-out">↓ {tx.dropped.name}</span>
            <span className="history-pos">{tx.dropped.pos}</span>
            <span className="history-arrow">→</span>
            <span className="history-in">↑ {tx.added.name}</span>
          </div>
          {tx.notes && <span className="history-notes">"{tx.notes}"</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Danger zone ─────────────────────────────────────────────────────────────
function DangerTab({ notify, pin }) {
  return (
    <div className="danger-tab">
      <div className="danger-blurb">
        <span className="danger-icon">⚠</span>
        These actions are destructive and require PIN re-entry.
      </div>
      <div className="danger-grid">
        <DangerAction
          label="Reset Draft"
          description="Delete all draft picks. Players become undrafted; rosters wipe."
          confirmLabel="Reset"
          pin={pin}
          onConfirm={() => notify(true, 'Draft reset.')}
        />
        <DangerAction
          label="Wipe Season Data"
          description="Delete EVERYTHING: teams, players, HRs, picks, transactions. League returns to empty state."
          confirmLabel="Wipe everything"
          pin={pin}
          extraDangerous
          onConfirm={() => notify(true, 'Season data wiped.')}
        />
      </div>
    </div>
  );
}

function DangerAction({ label, description, confirmLabel, pin, onConfirm, extraDangerous }) {
  const [stage, setStage] = aS('idle'); // 'idle' | 'pin' | 'done'
  const [entered, setEntered] = aS('');
  const [err, setErr] = aS('');

  function tryConfirm() {
    if (entered === pin) {
      setStage('done');
      onConfirm();
      setTimeout(() => { setStage('idle'); setEntered(''); }, 1500);
    } else {
      setErr('Wrong PIN');
    }
  }

  if (stage === 'pin') {
    return (
      <div className={`danger-card is-active${extraDangerous ? ' is-extra' : ''}`}>
        <div className="danger-card-head">{label}</div>
        <div className="danger-card-blurb">Re-enter PIN to confirm. This cannot be undone.</div>
        <div className="danger-pin-row">
          <input
            type="password"
            placeholder="••••"
            value={entered}
            onChange={e => { setEntered(e.target.value); setErr(''); }}
            onKeyDown={e => e.key === 'Enter' && tryConfirm()}
            autoFocus
            className={err ? 'has-err' : ''}
          />
          <button className="danger-pin-confirm" onClick={tryConfirm} disabled={!entered}>{confirmLabel}</button>
          <button className="danger-pin-cancel" onClick={() => { setStage('idle'); setEntered(''); setErr(''); }}>Cancel</button>
        </div>
        {err && <div className="danger-pin-err">{err}</div>}
      </div>
    );
  }

  if (stage === 'done') {
    return <div className="danger-card is-done">{label} — done.</div>;
  }

  return (
    <div className={`danger-card${extraDangerous ? ' is-extra' : ''}`}>
      <div className="danger-card-head">{label}</div>
      <div className="danger-card-blurb">{description}</div>
      <button className="danger-card-trigger" onClick={() => setStage('pin')}>{label}</button>
    </div>
  );
}

Object.assign(window, { AdminScreen });
