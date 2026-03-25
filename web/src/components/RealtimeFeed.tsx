'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { HomeRun } from '@/lib/types';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function HRCard({ hr, fresh }: { hr: HomeRun; fresh?: boolean }) {
  const player   = hr.players;
  const team     = player?.teams?.name || '?';
  const distStr  = hr.distance != null ? `${hr.distance} ft` : '';
  const label    = hr.mickey_meter_label;

  return (
    <div className={[
      'border rounded-lg p-3 transition-all duration-500',
      fresh
        ? 'border-[#f5c518] bg-[#1a1800]'
        : 'border-[#2a2a2a] bg-[#161616]',
    ].join(' ')}>
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{player?.name}</div>
          <div className="text-xs text-[#888] mt-0.5">
            {team}
            {distStr && <span className="ml-2 text-[#f5c518]">· {distStr}</span>}
          </div>
        </div>
        <div className="text-xs text-[#666] whitespace-nowrap shrink-0">
          {timeAgo(hr.hit_at)}
        </div>
      </div>
      {label && (
        <div className="mt-1.5 text-[10px] text-[#666] italic truncate">{label}</div>
      )}
    </div>
  );
}

interface Props {
  initialHRs: HomeRun[];
}

export default function RealtimeFeed({ initialHRs }: Props) {
  const [hrs, setHrs]       = useState<HomeRun[]>(initialHRs);
  const [freshId, setFresh] = useState<string | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel('feed_insert')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'home_runs' },
        async (payload) => {
          // Fetch the full row with player/team joins
          const { data } = await supabase
            .from('home_runs')
            .select('*, players(name, position, teams(name))')
            .eq('id', payload.new.id)
            .single();
          if (data) {
            setHrs(prev => [data, ...prev].slice(0, 15));
            setFresh(data.id);
            setTimeout(() => setFresh(null), 5000);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent Dingers</h2>
        <span className="flex items-center gap-1.5 text-xs text-[#888]">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          live
        </span>
      </div>

      {hrs.length === 0 ? (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-lg p-6 text-center text-[#555] text-sm">
          No HRs yet. Season starts soon!
        </div>
      ) : (
        <div className="space-y-2">
          {hrs.map(hr => (
            <HRCard key={hr.id} hr={hr} fresh={hr.id === freshId} />
          ))}
        </div>
      )}
    </div>
  );
}
