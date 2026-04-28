'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { HomeRun } from '@/lib/types';
import { getTeamColor } from '@/lib/types';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function FeedRow({ hr, fresh }: { hr: HomeRun; fresh?: boolean }) {
  const player   = hr.players;
  const teamName = player?.teams?.name ?? '?';
  const teamId   = (player as any)?.team_id as string | undefined;
  const color    = teamId ? getTeamColor(teamId) : 'var(--c-textDim)';

  const label = hr.mickey_meter_label;
  const count = hr.mickey_meter_count;
  const isLegit = label?.toUpperCase().includes('LEGIT');

  return (
    <div
      className={`feed-row${fresh ? ' is-fresh' : ''}`}
      style={{ '--team': color } as React.CSSProperties}
    >
      <div className="feed-bar" />
      <div className="feed-main">
        <div className="feed-row1">
          <span className="feed-name">{player?.name ?? '—'}</span>
          {player?.position && <span className="feed-pos">{player.position}</span>}
          <span className="feed-ago">{timeAgo(hr.hit_at)}</span>
        </div>
        <div className="feed-row2">
          <span className="feed-team">{teamName}</span>
          {hr.distance != null && (
            <>
              <span className="feed-divider">·</span>
              <span className="feed-dist">{hr.distance} ft</span>
            </>
          )}
          {hr.launch_speed != null && (
            <>
              <span className="feed-divider">·</span>
              <span className="feed-ev">{hr.launch_speed} mph</span>
            </>
          )}
          {label && count != null && (
            <span className={`feed-mickey ${isLegit ? 'is-legit' : 'is-mouse'}`}>
              {isLegit ? 'LEGIT' : 'MICKEY'} {count}/30
            </span>
          )}
        </div>
      </div>
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'home_runs' }, async (payload) => {
        const { data } = await supabase
          .from('home_runs')
          .select('*, players(name, position, team_id, teams(name))')
          .eq('id', payload.new.id)
          .single();
        if (data) {
          setHrs(prev => [data, ...prev].slice(0, 15));
          setFresh(data.id);
          setTimeout(() => setFresh(null), 5000);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <section className="card card-feed">
      <div className="card-head">
        <div className="card-head-l">
          <h2 className="card-title">Live Feed</h2>
        </div>
        <div className="card-head-r">
          <span className="livepill livepill-sm">
            <span className="livedot" />
            <span>LIVE</span>
          </span>
        </div>
      </div>

      {hrs.length === 0 ? (
        <div className="feed-empty">NO DINGERS YET</div>
      ) : (
        <div className="feed-list">
          {hrs.slice(0, 12).map(hr => (
            <FeedRow key={hr.id} hr={hr} fresh={hr.id === freshId} />
          ))}
        </div>
      )}
    </section>
  );
}
