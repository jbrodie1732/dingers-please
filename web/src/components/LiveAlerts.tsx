'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getTeamColor } from '@/lib/types';

type HRToast = {
  id: string;
  playerName: string;
  teamName: string;
  teamColor: string;
  distance: number | null;
  exitVelo: number | null;
  launchAngle: number | null;
  mickeyMeter: number | null;
  mickeyLabel: string | null;
};

function TickUp({ to, suffix = '', decimals = 0 }: { to: number; suffix?: string; decimals?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 900;
    let raf: number;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <span>{v.toFixed(decimals)}{suffix}</span>;
}

function MickeyTag({ mm, label }: { mm: number; label: string }) {
  const ok = label === 'LEGIT';
  return (
    <span className={`mickey-tag ${ok ? 'is-legit' : 'is-mouse'}`}>
      <span className="mickey-num">{mm}</span>
      <span className="mickey-of">/30</span>
    </span>
  );
}

function CelebrationToast({ hr, onClose }: { hr: HRToast; onClose: () => void }) {
  return (
    <div className="toast toast-medium" style={{ '--team': hr.teamColor } as React.CSSProperties}>
      <div className="toast-bar" />
      <div className="toast-body">
        <div className="toast-row1">
          <span className="toast-eyebrow">DINGER</span>
          <button className="toast-x" onClick={onClose} aria-label="Dismiss">×</button>
        </div>
        <div className="toast-name">{hr.playerName}</div>
        <div className="toast-team">{hr.teamName}</div>
        <div className="toast-stats">
          <div className="stat">
            <div className="stat-label">DIST</div>
            <div className="stat-value">
              {hr.distance != null ? <TickUp to={hr.distance} suffix=" ft" /> : '—'}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">EV</div>
            <div className="stat-value">
              {hr.exitVelo != null ? <TickUp to={hr.exitVelo} suffix=" mph" decimals={1} /> : '—'}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">LA</div>
            <div className="stat-value">
              {hr.launchAngle != null ? <TickUp to={hr.launchAngle} suffix="°" /> : '—'}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">METER</div>
            <div className="stat-value">
              {hr.mickeyMeter != null && hr.mickeyLabel
                ? <MickeyTag mm={hr.mickeyMeter} label={hr.mickeyLabel} />
                : '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LiveAlerts() {
  const [toast, setToast] = useState<HRToast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((hr: HRToast) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(hr);
    timerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    const ch = supabase.channel('live-alerts-hr')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'home_runs' }, async (payload) => {
        const row = payload.new as {
          id: string;
          player_id: string;
          distance: number | null;
          launch_speed: number | null;
          launch_angle: number | null;
          mickey_meter_count: number | null;
          mickey_meter_label: string | null;
        };

        const { data: player } = await supabase
          .from('players')
          .select('id, name, team_id, teams(id, name)')
          .eq('id', row.player_id)
          .single();

        if (!player) return;

        const teamData = (player as any).teams as { id: string; name: string } | null;
        const teamColor = teamData?.id ? getTeamColor(teamData.id) : 'var(--c-accent)';

        showToast({
          id: row.id,
          playerName: (player as any).name,
          teamName: teamData?.name ?? 'Unknown',
          teamColor,
          distance: row.distance,
          exitVelo: row.launch_speed,
          launchAngle: row.launch_angle,
          mickeyMeter: row.mickey_meter_count,
          mickeyLabel: row.mickey_meter_label,
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [showToast]);

  if (!toast) return null;
  return <CelebrationToast hr={toast} onClose={() => setToast(null)} />;
}
