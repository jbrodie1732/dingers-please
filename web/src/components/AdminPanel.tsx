'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Team, Player } from '@/lib/types';

const SEASON = 2026;

type Transaction = {
  id: string;
  effective_at: string;
  notes: string | null;
  teams?: { name: string };
  dropped: { name: string; position: string } | null;
  added:   { name: string } | null;
};

type RosterPlayer = Player & { total_hrs: number };

export default function AdminPanel() {
  const [pin,    setPin]    = useState('');
  const [authed, setAuthed] = useState(false);

  const [teams,        setTeams]        = useState<Team[]>([]);
  const [addDropLimit, setAddDropLimit] = useState<number>(2);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Add/drop state
  const [selectedTeam,   setSelectedTeam]   = useState<Team | null>(null);
  const [roster,         setRoster]         = useState<RosterPlayer[]>([]);
  const [dropPlayer,     setDropPlayer]     = useState<RosterPlayer | null>(null);
  const [addName,        setAddName]        = useState('');
  const [adNotes,        setAdNotes]        = useState('');
  const [teamBudgets,    setTeamBudgets]    = useState<Record<string, { used: number; limit: number }>>({});

  // Config state
  const [newLimit, setNewLimit] = useState('');

  // Status
  const [status,  setStatus]  = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const [
      { data: teamsData },
      { data: configData },
      { data: txData },
    ] = await Promise.all([
      supabase.from('teams').select('id, name, draft_position, created_at').order('name'),
      supabase.from('season_config').select('add_drop_limit').eq('season', SEASON).single(),
      supabase
        .from('transactions')
        .select('id, effective_at, notes, teams(name), dropped:players!dropped_player_id(name, position), added:players!added_player_id(name)')
        .eq('season', SEASON)
        .order('effective_at', { ascending: false }),
    ]);
    if (teamsData) setTeams(teamsData as Team[]);
    if (configData) setAddDropLimit(configData.add_drop_limit ?? 2);
    if (txData) setTransactions(txData as unknown as Transaction[]);

    // Load budget per team
    if (teamsData) {
      const budgets: Record<string, { used: number; limit: number }> = {};
      for (const t of teamsData) {
        const { count } = await supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', t.id)
          .eq('season', SEASON);
        budgets[t.id] = { used: count ?? 0, limit: configData?.add_drop_limit ?? 2 };
      }
      setTeamBudgets(budgets);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Load roster when team is selected
  useEffect(() => {
    if (!selectedTeam) { setRoster([]); setDropPlayer(null); return; }
    supabase
      .from('players')
      .select('id, name, position, team_id, mlb_player_id, created_at')
      .eq('team_id', selectedTeam.id)
      .is('dropped_at', null)
      .order('position')
      .then(({ data }) => setRoster((data ?? []) as RosterPlayer[]));
  }, [selectedTeam]);

  async function callAdmin(action: string, extra: object = {}) {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin: pin, action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ ok: false, msg: data.error ?? 'Unknown error' });
      } else {
        setStatus({ ok: true, msg: data.message });
        fetchData();
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitAddDrop() {
    if (!selectedTeam || !dropPlayer || !addName.trim()) return;
    await callAdmin('add-drop', {
      teamId:       selectedTeam.id,
      dropPlayerId: dropPlayer.id,
      addPlayerName: addName.trim(),
      notes:        adNotes.trim() || undefined,
    });
    setDropPlayer(null);
    setAddName('');
    setAdNotes('');
    setSelectedTeam(null);
  }

  if (!authed) {
    return (
      <div className="max-w-sm space-y-3">
        <p className="text-[#888] text-sm">Enter your admin PIN to access these tools.</p>
        <div className="flex gap-2">
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
        </div>
      </div>
    );
  }

  const budget = selectedTeam ? teamBudgets[selectedTeam.id] : null;
  const budgetExhausted = budget ? budget.used >= budget.limit : false;

  return (
    <div className="space-y-8">

      {/* Status banner */}
      {status && (
        <div className={['px-4 py-3 rounded text-sm', status.ok ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'].join(' ')}>
          {status.msg}
        </div>
      )}

      {/* ── Add / Drop ── */}
      <section className="space-y-4">
        <h2 className="text-[#f5c518] font-semibold text-base">➕➖ Add / Drop</h2>

        {/* Team picker */}
        <div className="space-y-1">
          <label className="text-[#888] text-xs uppercase tracking-wide">Team</label>
          <div className="flex flex-wrap gap-2">
            {teams.map(t => {
              const b = teamBudgets[t.id];
              const exhausted = b ? b.used >= b.limit : false;
              return (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTeam(t); setDropPlayer(null); setAddName(''); }}
                  className={[
                    'px-3 py-1.5 rounded text-sm border transition-colors',
                    exhausted ? 'border-[#2a2a2a] text-[#444] cursor-not-allowed' :
                    selectedTeam?.id === t.id
                      ? 'border-[#f5c518] text-[#f5c518] bg-[#1a1a1a]'
                      : 'border-[#2a2a2a] text-[#888] hover:border-[#444] hover:text-[#ccc]',
                  ].join(' ')}
                >
                  {t.name}
                  {b && <span className="ml-1.5 text-xs opacity-60">{b.limit - b.used}/{b.limit}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {selectedTeam && !budgetExhausted && (
          <>
            {/* Roster — pick who to drop */}
            <div className="space-y-1">
              <label className="text-[#888] text-xs uppercase tracking-wide">Drop</label>
              <div className="rounded border border-[#2a2a2a] divide-y divide-[#1a1a1a] overflow-hidden">
                {roster.length === 0 && (
                  <div className="px-3 py-2 text-[#555] text-sm">No active players found</div>
                )}
                {roster.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setDropPlayer(p)}
                    className={[
                      'w-full text-left px-3 py-2 text-sm flex items-center gap-3 transition-colors',
                      dropPlayer?.id === p.id
                        ? 'bg-red-900/20 text-red-400'
                        : 'text-[#ccc] hover:bg-[#161616]',
                    ].join(' ')}
                  >
                    <span className="font-mono text-xs text-[#666] w-8">{p.position}</span>
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Add name */}
            {dropPlayer && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[#888] text-xs uppercase tracking-wide">
                    Add ({dropPlayer.position} slot — replacing {dropPlayer.name})
                  </label>
                  <input
                    type="text"
                    placeholder="Full MLB name"
                    value={addName}
                    onChange={e => setAddName(e.target.value)}
                    className="w-full max-w-xs bg-[#1a1a1a] border border-[#333] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#f5c518]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[#888] text-xs uppercase tracking-wide">Notes (optional)</label>
                  <input
                    type="text"
                    placeholder="Injury, reason, etc."
                    value={adNotes}
                    onChange={e => setAdNotes(e.target.value)}
                    className="w-full max-w-xs bg-[#1a1a1a] border border-[#333] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#f5c518]"
                  />
                </div>
                <button
                  onClick={submitAddDrop}
                  disabled={loading || !addName.trim()}
                  className="px-4 py-2 bg-[#f5c518] text-black font-bold text-sm rounded hover:bg-yellow-400 disabled:opacity-50"
                >
                  {loading ? 'Processing…' : `Confirm: Drop ${dropPlayer.name} → Add ${addName || '?'}`}
                </button>
              </div>
            )}
          </>
        )}

        {selectedTeam && budgetExhausted && (
          <p className="text-red-400 text-sm">{selectedTeam.name} has used all {budget?.limit} add/drops this season.</p>
        )}
      </section>

      {/* ── Add/Drop Limit ── */}
      <section className="space-y-3 border-t border-[#1a1a1a] pt-6">
        <h2 className="text-[#f5c518] font-semibold text-base">⚙️ Season Config</h2>
        <div className="flex items-center gap-3">
          <span className="text-[#888] text-sm">Add/drop limit per team:</span>
          <span className="text-white font-semibold">{addDropLimit}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={10}
            placeholder="New limit"
            value={newLimit}
            onChange={e => setNewLimit(e.target.value)}
            className="w-24 bg-[#1a1a1a] border border-[#333] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#f5c518]"
          />
          <button
            onClick={() => { callAdmin('set-add-drop-limit', { limit: parseInt(newLimit) }); setNewLimit(''); }}
            disabled={loading || !newLimit}
            className="px-3 py-1.5 bg-[#1e1e1e] border border-[#333] text-[#ccc] text-sm rounded hover:bg-[#2a2a2a] disabled:opacity-50"
          >
            Update
          </button>
        </div>
      </section>

      {/* ── Transaction History ── */}
      <section className="space-y-3 border-t border-[#1a1a1a] pt-6">
        <h2 className="text-[#f5c518] font-semibold text-base">📋 Transaction History</h2>
        {transactions.length === 0 ? (
          <p className="text-[#555] text-sm">No transactions yet.</p>
        ) : (
          <div className="space-y-1">
            {transactions.map(tx => (
              <div key={tx.id} className="flex flex-wrap items-baseline gap-2 px-3 py-2 rounded bg-[#0d0d0d] text-sm">
                <span className="text-[#555] text-xs">{new Date(tx.effective_at).toLocaleDateString()}</span>
                <span className="text-[#f5c518] font-semibold">{tx.teams?.name}</span>
                <span className="text-red-400">↓ {tx.dropped?.name}</span>
                <span className="text-[#555]">→</span>
                <span className="text-green-400">↑ {tx.added?.name}</span>
                <span className="text-[#555] font-mono text-xs">{tx.dropped?.position}</span>
                {tx.notes && <span className="text-[#666] text-xs italic">{tx.notes}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Danger Zone ── */}
      <section className="space-y-3 border-t border-red-900/40 pt-6">
        <h2 className="text-red-500 font-semibold text-base">⚠️ Danger Zone</h2>
        <div className="flex flex-wrap gap-3">
          <DangerButton
            label="Reset Draft"
            description="Delete all draft picks and unassign all players"
            confirmLabel="Yes, reset the draft"
            onConfirm={() => callAdmin('reset-draft')}
            loading={loading}
          />
          <DangerButton
            label="Wipe All Data"
            description="Delete everything — all teams, players, HRs, picks, transactions"
            confirmLabel="Yes, wipe everything"
            onConfirm={() => callAdmin('wipe')}
            loading={loading}
            extraDangerous
          />
        </div>
        <p className="text-[#444] text-xs">
          Note: <strong className="text-[#555]">load-player-pool</strong> must be run locally — it reads from <code>data/positions.csv</code> on your machine.
        </p>
      </section>

      <button onClick={() => { setAuthed(false); setPin(''); }} className="text-[#444] text-xs hover:text-[#666]">
        Lock admin
      </button>
    </div>
  );
}

function DangerButton({
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
      <div className="border border-red-800 rounded p-3 space-y-2 max-w-xs">
        <p className="text-red-400 text-sm font-semibold">{description}</p>
        <div className="flex gap-2">
          <button
            onClick={() => { setConfirming(false); onConfirm(); }}
            disabled={loading}
            className="px-3 py-1 bg-red-800 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
          >
            {confirmLabel}
          </button>
          <button onClick={() => setConfirming(false)} className="px-3 py-1 text-[#666] text-sm hover:text-[#888]">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      disabled={loading}
      className={[
        'px-3 py-2 rounded text-sm border transition-colors disabled:opacity-50',
        extraDangerous
          ? 'border-red-900 text-red-500 hover:bg-red-900/20'
          : 'border-[#3a2a2a] text-[#cc6666] hover:bg-red-900/10',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
