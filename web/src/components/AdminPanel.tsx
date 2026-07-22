'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Team, DraftPick } from '@/lib/types';
import { getTeamColor } from '@/lib/types';

const SEASON = 2026;

type Transaction = {
  id: string;
  effective_at: string;
  notes: string | null;
  teams?: { name: string };
  dropped: { name: string; position: string } | null;
  added:   { name: string } | null;
};

type RosterPlayer = { id: string; name: string; position: string };
type PoolPlayer   = { id: string; name: string; position: string };

type TabId = 'addrop' | 'hr' | 'draft' | 'config' | 'history' | 'danger';

const TABS: { id: TabId; label: string; glyph: string }[] = [
  { id: 'addrop',  label: 'Add / Drop', glyph: '⇄' },
  { id: 'hr',      label: 'Manual HR',  glyph: '◎' },
  { id: 'draft',   label: 'Draft',      glyph: '↩' },
  { id: 'config',  label: 'Season',     glyph: '⚙' },
  { id: 'history', label: 'History',    glyph: '☰' },
  { id: 'danger',  label: 'Danger',     glyph: '⚠' },
];

export default function AdminPanel() {
  const [pin,        setPin]        = useState('');
  const [authed,     setAuthed]     = useState(false);
  const [pinError,   setPinError]   = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [tab,        setTab]        = useState<TabId>('addrop');

  const [teams,        setTeams]        = useState<Team[]>([]);
  const [addDropLimit, setAddDropLimit] = useState(2);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [teamBudgets,  setTeamBudgets]  = useState<Record<string, { used: number; limit: number }>>({});

  // Draft tools (undo / override)
  const [picks,       setPicks]       = useState<DraftPick[]>([]);
  const [poolPlayers, setPoolPlayers] = useState<PoolPlayer[]>([]);
  const [overridingPickId, setOverridingPickId] = useState<string | null>(null);
  const [overrideSearch,   setOverrideSearch]   = useState('');

  // Add/drop
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [roster,       setRoster]       = useState<RosterPlayer[]>([]);
  const [dropPlayer,   setDropPlayer]   = useState<RosterPlayer | null>(null);
  const [addName,      setAddName]      = useState('');
  const [adNotes,      setAdNotes]      = useState('');
  // Open slots = players dropped without a replacement (recovery path)
  const [openSlots,    setOpenSlots]    = useState<RosterPlayer[]>([]);
  const [fillNames,    setFillNames]    = useState<Record<string, string>>({});

  // Manual HR
  const [hrPlayer, setHrPlayer] = useState('');
  const [hrTeamId, setHrTeamId] = useState('');
  const [hrDist,   setHrDist]   = useState(420);
  const [hrEv,     setHrEv]     = useState(105);
  const [hrAngle,  setHrAngle]  = useState(28);

  // Config
  const [draftLimit, setDraftLimit] = useState(2);

  const [status,  setStatus]  = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function tryUnlock() {
    if (!pin) { setPinError('Enter your PIN'); return; }
    setPinLoading(true);
    setPinError('');
    const res = await fetch('/api/admin', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ adminPin: pin, action: 'verify' }),
    });
    setPinLoading(false);
    if (res.ok) { setAuthed(true); }
    else         { setPinError('Invalid PIN'); }
  }

  const fetchData = useCallback(async () => {
    const [{ data: teamsData }, { data: configData }, { data: txData }, { data: pickData }, { data: poolData }] = await Promise.all([
      supabase.from('teams').select('id, name, draft_position, created_at').order('name'),
      supabase.from('season_config').select('add_drop_limit').eq('season', SEASON).single(),
      supabase
        .from('transactions')
        .select('id, effective_at, notes, teams(name), dropped:players!dropped_player_id(name, position), added:players!added_player_id(name)')
        .eq('season', SEASON)
        .order('effective_at', { ascending: false }),
      supabase
        .from('draft_picks')
        .select('id, season, round, pick_in_round, overall_pick, player_id, team_id, drafted_at, players(id, name, position), teams(name)')
        .eq('season', SEASON)
        .order('overall_pick', { ascending: false }),
      supabase
        .from('players')
        .select('id, name, position')
        .is('team_id', null)
        .order('name'),
    ]);
    if (teamsData) {
      setTeams(teamsData as Team[]);
      setHrTeamId((teamsData as Team[])[0]?.id ?? '');
    }
    const lim = configData?.add_drop_limit ?? 2;
    if (configData) { setAddDropLimit(lim); setDraftLimit(lim); }
    if (txData)     { setTransactions(txData as unknown as Transaction[]); }
    if (pickData)   { setPicks(pickData as unknown as DraftPick[]); }
    if (poolData)   { setPoolPlayers(poolData as PoolPlayer[]); }

    if (teamsData) {
      const budgets: Record<string, { used: number; limit: number }> = {};
      await Promise.all((teamsData as Team[]).map(async t => {
        const { count } = await supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', t.id)
          .eq('season', SEASON);
        budgets[t.id] = { used: count ?? 0, limit: lim };
      }));
      setTeamBudgets(budgets);
    }
  }, []);

  useEffect(() => { if (authed) fetchData(); }, [authed, fetchData]);

  useEffect(() => {
    if (!selectedTeam) { setRoster([]); setDropPlayer(null); setOpenSlots([]); setFillNames({}); return; }
    supabase
      .from('players')
      .select('id, name, position, dropped_at')
      .eq('team_id', selectedTeam.id)
      .order('position')
      .then(({ data }) => {
        const rows = (data ?? []) as (RosterPlayer & { dropped_at: string | null })[];
        const active = rows.filter(p => !p.dropped_at);
        setRoster(active);
        // An open slot = a position that has a dropped player but no active one.
        const activePositions = new Set(active.map(p => p.position));
        const dropped = rows
          .filter(p => p.dropped_at && !activePositions.has(p.position))
          .sort((a, b) => (b.dropped_at! < a.dropped_at! ? -1 : 1)); // most-recent first
        const byPosition = new Map<string, RosterPlayer>();
        for (const p of dropped) {
          if (!byPosition.has(p.position)) byPosition.set(p.position, p);
        }
        setOpenSlots(Array.from(byPosition.values()));
      });
  }, [selectedTeam]);

  async function callAdmin(action: string, extra: object = {}) {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ adminPin: pin, action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) { setStatus({ ok: false, msg: data.error ?? 'Unknown error' }); }
      else          { setStatus({ ok: true, msg: data.message }); fetchData(); }
    } finally {
      setLoading(false);
    }
  }

  async function submitAddDrop() {
    if (!selectedTeam || !dropPlayer || !addName.trim()) return;
    await callAdmin('add-drop', {
      teamId:        selectedTeam.id,
      dropPlayerId:  dropPlayer.id,
      addPlayerName: addName.trim(),
      notes:         adNotes.trim() || undefined,
    });
    setDropPlayer(null); setAddName(''); setAdNotes(''); setSelectedTeam(null);
  }

  async function submitFillSlot(slot: RosterPlayer) {
    if (!selectedTeam) return;
    const name = (fillNames[slot.id] ?? '').trim();
    if (!name) return;
    await callAdmin('fill-slot', {
      teamId:          selectedTeam.id,
      droppedPlayerId: slot.id,
      addPlayerName:   name,
    });
    setFillNames({}); setSelectedTeam(null);
  }

  // ── PIN gate ──────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="admin-pin-card">
        <div className="admin-pin-glyph">
          <svg viewBox="0 0 32 32" width="36" height="36">
            <rect x="6" y="14" width="20" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M11 14 V 10 a 5 5 0 0 1 10 0 V 14" fill="none" stroke="currentColor" strokeWidth="1.6"/>
            <circle cx="16" cy="20" r="2" fill="currentColor"/>
            <line x1="16" y1="22" x2="16" y2="25" stroke="currentColor" strokeWidth="1.6"/>
          </svg>
        </div>
        <div className="admin-pin-eyebrow">COMMISSIONER ACCESS</div>
        <h2 className="admin-pin-title">Enter PIN</h2>
        <div className="admin-pin-input">
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={e => { setPin(e.target.value); setPinError(''); }}
            onKeyDown={e => e.key === 'Enter' && tryUnlock()}
            autoFocus
            placeholder="••••"
            className={pinError ? 'has-err' : ''}
          />
          <button className="admin-pin-btn" onClick={tryUnlock} disabled={pinLoading}>
            {pinLoading ? '…' : 'Unlock'}
          </button>
        </div>
        {pinError && <div className="admin-pin-err">{pinError}</div>}
      </div>
    );
  }

  // ── Authed shell ──────────────────────────────────────────────────────────
  const budget          = selectedTeam ? teamBudgets[selectedTeam.id] : null;
  const budgetExhausted = budget ? budget.used >= budget.limit : false;

  return (
    <div className="admin-shell">
      <div className="admin-shell-head">
        <div>
          <div className="admin-eyebrow">COMMISSIONER · UNLOCKED</div>
          <h2 className="admin-title">Admin Panel</h2>
        </div>
      </div>

      <div className="admin-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`atab${tab === t.id ? ' is-on' : ''}${t.id === 'danger' ? ' is-danger' : ''}`}
            onClick={() => setTab(t.id)}
          >
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

        {/* ── Add / Drop ─────────────────────────────────────────────────── */}
        {tab === 'addrop' && (
          <div className="addrop">
            <div className="addrop-step">
              <div className="addrop-step-head"><span className="step-num">1</span> Pick a team</div>
              <div className="addrop-teams">
                {teams.map(t => {
                  const b    = teamBudgets[t.id];
                  const out  = b ? b.used >= b.limit : false;
                  const isOn = selectedTeam?.id === t.id;
                  const color = getTeamColor(t.id, t.draft_position);
                  return (
                    <button
                      key={t.id}
                      className={`addrop-team${isOn ? ' is-on' : ''}${out ? ' is-out' : ''}`}
                      style={isOn ? { borderColor: color, boxShadow: `0 0 0 2px ${color}33` } : {}}
                      disabled={out}
                      onClick={() => { setSelectedTeam(t); setDropPlayer(null); setAddName(''); }}
                    >
                      <span className="addrop-team-dot" style={{ background: color }} />
                      <span className="addrop-team-name">{t.name}</span>
                      {b && <span className="addrop-team-budget">{b.limit - b.used}/{b.limit}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedTeam && !budgetExhausted && openSlots.length > 0 && (
              <div className="addrop-step">
                <div className="addrop-step-head">
                  <span className="step-num">!</span>
                  Open slot{openSlots.length > 1 ? 's' : ''} — needs a replacement
                  <span className="addrop-step-sub">a player was dropped without an add</span>
                </div>
                {openSlots.map(slot => (
                  <div key={slot.id} className="addrop-form" style={{ marginBottom: 8 }}>
                    <div className="addrop-field" style={{ minWidth: 150 }}>
                      <div className="addrop-field-lbl">{slot.position} — DROPPED</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, padding: '6px 0' }}>{slot.name}</div>
                    </div>
                    <label className="addrop-field">
                      <div className="addrop-field-lbl">ADD A {slot.position}</div>
                      <input
                        className="addrop-input"
                        placeholder="Full MLB name"
                        value={fillNames[slot.id] ?? ''}
                        onChange={e => setFillNames(f => ({ ...f, [slot.id]: e.target.value }))}
                      />
                    </label>
                    <button
                      className="addrop-submit"
                      style={{ background: getTeamColor(selectedTeam.id, selectedTeam.draft_position) }}
                      onClick={() => submitFillSlot(slot)}
                      disabled={!(fillNames[slot.id] ?? '').trim() || loading}
                    >
                      {loading ? 'Processing…' : <>Add <b>{(fillNames[slot.id] ?? '').trim() || '?'}</b></>}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedTeam && !budgetExhausted && (
              <div className="addrop-step">
                <div className="addrop-step-head"><span className="step-num">2</span> Drop a player</div>
                <div className="addrop-roster">
                  {roster.length === 0 && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--c-textDim)', letterSpacing: '0.1em', padding: '12px 0' }}>
                      NO ACTIVE PLAYERS FOUND
                    </div>
                  )}
                  {roster.map(p => (
                    <button
                      key={p.id}
                      className={`addrop-rost${dropPlayer?.id === p.id ? ' is-on' : ''}`}
                      onClick={() => setDropPlayer(p)}
                    >
                      <span className="addrop-rost-pos">{p.position}</span>
                      <span className="addrop-rost-name">{p.name}</span>
                      <span className="addrop-rost-mlb">—</span>
                      <span className="addrop-rost-hrs">—</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedTeam && dropPlayer && (
              <div className="addrop-step">
                <div className="addrop-step-head">
                  <span className="step-num">3</span>
                  Add a {dropPlayer.position}
                  <span className="addrop-step-sub">replacing {dropPlayer.name}</span>
                </div>
                <div className="addrop-form">
                  <label className="addrop-field">
                    <div className="addrop-field-lbl">PLAYER NAME</div>
                    <input className="addrop-input" placeholder="Full MLB name"
                           value={addName} onChange={e => setAddName(e.target.value)} autoFocus />
                  </label>
                  <label className="addrop-field">
                    <div className="addrop-field-lbl">NOTES (OPTIONAL)</div>
                    <input className="addrop-input" placeholder="Injury, slump, etc."
                           value={adNotes} onChange={e => setAdNotes(e.target.value)} />
                  </label>
                  <button
                    className="addrop-submit"
                    style={{ background: getTeamColor(selectedTeam.id, selectedTeam.draft_position) }}
                    onClick={submitAddDrop}
                    disabled={!addName.trim() || loading}
                  >
                    {loading ? 'Processing…' : <>Drop <b>{dropPlayer.name}</b> → Add <b>{addName || '?'}</b></>}
                  </button>
                </div>
              </div>
            )}

            {selectedTeam && budgetExhausted && (
              <div className="addrop-exhausted">
                {selectedTeam.name} has used all {budget?.limit} add/drops this season.
              </div>
            )}
          </div>
        )}

        {/* ── Manual HR ──────────────────────────────────────────────────── */}
        {tab === 'hr' && (
          <div className="manual-hr">
            <div className="manual-hr-blurb">
              Log a home run the data feed missed. Looks up the player by name within the selected team
              and inserts directly into the database.
            </div>
            <div className="manual-hr-form">
              <div className="mhr-row">
                <label className="mhr-field mhr-field-grow">
                  <div className="mhr-lbl">PLAYER NAME</div>
                  <input className="mhr-input" placeholder="e.g. Aaron Judge"
                         value={hrPlayer} onChange={e => setHrPlayer(e.target.value)} />
                </label>
                <label className="mhr-field">
                  <div className="mhr-lbl">TEAM</div>
                  <select className="mhr-input" value={hrTeamId} onChange={e => setHrTeamId(e.target.value)}>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </label>
              </div>
              <div className="mhr-row">
                <label className="mhr-field">
                  <div className="mhr-lbl">DISTANCE (ft)</div>
                  <input className="mhr-input" type="number" value={hrDist} style={{ width: 110 }}
                         onChange={e => setHrDist(parseInt(e.target.value) || 0)} />
                </label>
                <label className="mhr-field">
                  <div className="mhr-lbl">EXIT VELO (mph)</div>
                  <input className="mhr-input" type="number" step="0.1" value={hrEv} style={{ width: 110 }}
                         onChange={e => setHrEv(parseFloat(e.target.value) || 0)} />
                </label>
                <label className="mhr-field">
                  <div className="mhr-lbl">LAUNCH ANGLE (°)</div>
                  <input className="mhr-input" type="number" value={hrAngle} style={{ width: 110 }}
                         onChange={e => setHrAngle(parseInt(e.target.value) || 0)} />
                </label>
              </div>
              <div className="mhr-row mhr-actions">
                <button
                  className="mhr-submit"
                  disabled={!hrPlayer.trim() || loading}
                  onClick={() => callAdmin('log-hr', {
                    playerName:  hrPlayer.trim(),
                    teamId:      hrTeamId,
                    distance:    hrDist,
                    launchSpeed: hrEv,
                    launchAngle: hrAngle,
                  })}
                >
                  {loading ? 'Logging…' : 'Log Home Run'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Draft tools ─────────────────────────────────────────────────── */}
        {tab === 'draft' && (
          <DraftToolsTab
            picks={picks}
            poolPlayers={poolPlayers}
            overridingPickId={overridingPickId}
            setOverridingPickId={setOverridingPickId}
            overrideSearch={overrideSearch}
            setOverrideSearch={setOverrideSearch}
            loading={loading}
            onUndo={() => callAdmin('undo-last-pick')}
            onOverride={(pickId, newPlayerId) => {
              callAdmin('override-pick', { pickId, newPlayerId });
              setOverridingPickId(null);
              setOverrideSearch('');
            }}
          />
        )}

        {/* ── Season Config ───────────────────────────────────────────────── */}
        {tab === 'config' && (
          <div className="config-tab">
            <div className="config-card">
              <div className="config-card-eyebrow">SEASON RULE</div>
              <div className="config-card-title">Add/drop limit per team</div>
              <div className="config-card-row">
                <button className="config-step" onClick={() => setDraftLimit(l => Math.max(0, l - 1))}>−</button>
                <div className="config-num">{draftLimit}</div>
                <button className="config-step" onClick={() => setDraftLimit(l => l + 1)}>+</button>
                <div className="config-num-lbl">moves / season</div>
              </div>
              <button
                className="config-save"
                disabled={draftLimit === addDropLimit || loading}
                onClick={() => callAdmin('set-add-drop-limit', { limit: draftLimit })}
              >
                Save change
              </button>
              <div className="config-foot">Currently: <b>{addDropLimit}</b> moves per team</div>
            </div>
          </div>
        )}

        {/* ── History ─────────────────────────────────────────────────────── */}
        {tab === 'history' && (
          <div className="history">
            {transactions.length === 0 ? (
              <div className="history-empty">NO TRANSACTIONS YET THIS SEASON</div>
            ) : transactions.map(tx => (
              <div key={tx.id} className="history-row">
                <span className="history-date">
                  {new Date(tx.effective_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span className="history-team">{tx.teams?.name}</span>
                <div className="history-move">
                  <span className="history-out">↓ {tx.dropped?.name}</span>
                  <span className="history-pos">{tx.dropped?.position}</span>
                  <span className="history-arrow">→</span>
                  <span className="history-in">↑ {tx.added?.name}</span>
                </div>
                {tx.notes && <span className="history-notes">"{tx.notes}"</span>}
              </div>
            ))}
          </div>
        )}

        {/* ── Danger ──────────────────────────────────────────────────────── */}
        {tab === 'danger' && <DangerTab onAction={callAdmin} loading={loading} />}
      </div>

      <div className="admin-foot">
        <button className="admin-lock-btn" onClick={() => { setAuthed(false); setPin(''); }}>
          <svg viewBox="0 0 16 16" width="12" height="12">
            <rect x="3" y="7" width="10" height="7" rx="1" fill="currentColor"/>
            <path d="M5.5 7 V 5 a 2.5 2.5 0 0 1 5 0 V 7" fill="none" stroke="currentColor" strokeWidth="1.4"/>
          </svg>
          Lock admin
        </button>
      </div>
    </div>
  );
}

function DangerTab({ onAction, loading }: { onAction: (a: string) => void; loading: boolean }) {
  return (
    <div className="danger-tab">
      <div className="danger-blurb">
        <span className="danger-icon">⚠</span>
        These actions are destructive and irreversible.
      </div>
      <div className="danger-grid">
        <DangerCard
          label="Reset Draft"
          description="Delete all draft picks. Players become undrafted; all rosters wipe."
          confirmLabel="Reset draft"
          onConfirm={() => onAction('reset-draft')}
          loading={loading}
        />
        <DangerCard
          label="Wipe All Season Data"
          description="Delete EVERYTHING: teams, players, HRs, picks, transactions. League returns to empty state."
          confirmLabel="Wipe everything"
          onConfirm={() => onAction('wipe')}
          loading={loading}
          extraDangerous
        />
      </div>
    </div>
  );
}

function DangerCard({
  label, description, confirmLabel, onConfirm, loading, extraDangerous = false,
}: {
  label: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  loading: boolean;
  extraDangerous?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className={`danger-card is-active${extraDangerous ? ' is-extra' : ''}`}>
        <div className="danger-card-head">{label}</div>
        <div className="danger-card-blurb">Are you sure? This cannot be undone.</div>
        <div className="danger-pin-row">
          <button className="danger-pin-confirm" disabled={loading}
                  onClick={() => { setConfirming(false); onConfirm(); }}>
            {confirmLabel}
          </button>
          <button className="danger-pin-cancel" onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`danger-card${extraDangerous ? ' is-extra' : ''}`}>
      <div className="danger-card-head">{label}</div>
      <div className="danger-card-blurb">{description}</div>
      <button className="danger-card-trigger" onClick={() => setConfirming(true)} disabled={loading}>
        {label}
      </button>
    </div>
  );
}

function DraftToolsTab({
  picks, poolPlayers, overridingPickId, setOverridingPickId,
  overrideSearch, setOverrideSearch, loading, onUndo, onOverride,
}: {
  picks:               DraftPick[];
  poolPlayers:         { id: string; name: string; position: string }[];
  overridingPickId:    string | null;
  setOverridingPickId: (id: string | null) => void;
  overrideSearch:      string;
  setOverrideSearch:   (s: string) => void;
  loading:             boolean;
  onUndo:              () => void;
  onOverride:          (pickId: string, newPlayerId: string) => void;
}) {
  const lastPick = picks[0]; // picks are ordered overall_pick desc

  return (
    <div className="draft-tools">
      <div className="draft-tools-blurb">
        Undo the most recent pick (click again to keep rewinding), or override any past pick with a
        different currently-available player at the same position without disturbing anything else.
      </div>

      <div className="undo-card">
        {lastPick ? (
          <>
            <div className="undo-card-info">
              <span className="undo-card-eyebrow">MOST RECENT PICK — #{lastPick.overall_pick} (RD {lastPick.round}.{lastPick.pick_in_round})</span>
              <span className="undo-card-name">{lastPick.players?.name}</span>
              <span className="undo-card-meta">{lastPick.players?.position} → {lastPick.teams?.name}</span>
            </div>
            <button className="undo-card-btn" onClick={onUndo} disabled={loading}>
              {loading ? '…' : 'Undo last pick'}
            </button>
          </>
        ) : (
          <div className="undo-card-empty">NO PICKS MADE YET</div>
        )}
      </div>

      <div className="pick-override-list">
        <div className="pol-head">ALL PICKS ({picks.length}) — click one to override</div>
        {picks.length === 0 && <div className="undo-card-empty">NO PICKS MADE YET</div>}
        {picks.map(pick => {
          const isOpen = overridingPickId === pick.id;
          const candidates = poolPlayers.filter(p =>
            p.position === pick.players?.position &&
            (!overrideSearch || p.name.toLowerCase().includes(overrideSearch.toLowerCase()))
          );
          return (
            <div key={pick.id} className={`pol-row${isOpen ? ' is-open' : ''}`}>
              <button
                className="pol-summary"
                onClick={() => { setOverridingPickId(isOpen ? null : pick.id); setOverrideSearch(''); }}
              >
                <span className="pol-num">#{pick.overall_pick}</span>
                <span className="pol-rd">RD{pick.round}.{pick.pick_in_round}</span>
                <span className="pol-team">{pick.teams?.name}</span>
                <span className="pol-arrow">→</span>
                <span className="pol-player">{pick.players?.name}</span>
                <span className="pol-pos">{pick.players?.position}</span>
              </button>
              {isOpen && (
                <div className="pol-override-panel">
                  <input
                    className="pol-search"
                    placeholder={`Search available ${pick.players?.position}s…`}
                    value={overrideSearch}
                    onChange={e => setOverrideSearch(e.target.value)}
                    autoFocus
                  />
                  <div className="pol-candidates">
                    {candidates.length === 0 && (
                      <div className="pol-empty">No available {pick.players?.position}s match.</div>
                    )}
                    {candidates.slice(0, 12).map(c => (
                      <button
                        key={c.id}
                        className="pol-candidate"
                        disabled={loading}
                        onClick={() => onOverride(pick.id, c.id)}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
