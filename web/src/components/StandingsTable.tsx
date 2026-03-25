'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { TeamStanding } from '@/lib/types';
import { TEAM_COLORS } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function getRank(standings: TeamStanding[], teamName: string): string {
  const sorted = [...standings].sort((a, b) => b.total_hrs - a.total_hrs);
  let rank = 1;
  let prevTotal: number | null = null;
  let prevRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    const { team_name, total_hrs } = sorted[i];
    if (total_hrs !== prevTotal) prevRank = rank;
    if (team_name === teamName) {
      const tied = sorted.filter(t => t.total_hrs === total_hrs).length > 1;
      return tied ? `T-${prevRank}` : `${prevRank}`;
    }
    prevTotal = total_hrs;
    rank = i + 2;
  }
  return '—';
}

interface Props {
  initialStandings: TeamStanding[];
}

export default function StandingsTable({ initialStandings }: Props) {
  const [standings, setStandings] = useState<TeamStanding[]>(initialStandings);
  const sorted = [...standings].sort((a, b) => b.total_hrs - a.total_hrs);

  // Realtime subscription — refresh standings on new HR
  useEffect(() => {
    const channel = supabase
      .channel('home_runs_insert')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'home_runs' }, async () => {
        const { data } = await supabase
          .from('team_standings')
          .select('*')
          .order('total_hrs', { ascending: false });
        if (data) setStandings(data);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const colorMap = Object.fromEntries(
    sorted.map((t, i) => [t.team_name, TEAM_COLORS[i % TEAM_COLORS.length]])
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Standings</h2>
        <span className="text-xs text-[#888]">live</span>
      </div>

      {/* Bar chart */}
      <div className="bg-[#161616] rounded-lg border border-[#2a2a2a] p-4" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sorted} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
            <XAxis type="number" tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="team_name"
              tick={{ fill: '#e8e8e8', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as TeamStanding;
                return (
                  <div className="bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-xs">
                    <div className="font-semibold text-[#f5c518]">{d.team_name}</div>
                    <div>{d.total_hrs} HRs</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="total_hrs" radius={[0, 3, 3, 0]}>
              {sorted.map((entry) => (
                <Cell key={entry.team_name} fill={colorMap[entry.team_name]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-[#161616] rounded-lg border border-[#2a2a2a] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2a2a] text-[#888] text-xs">
              <th className="text-left px-4 py-2 w-10">Rank</th>
              <th className="text-left px-4 py-2">Team</th>
              <th className="text-right px-4 py-2">HRs</th>
              <th className="text-right px-4 py-2 hidden sm:table-cell">Gap</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((team, i) => {
              const rank  = getRank(standings, team.team_name);
              const leader = sorted[0]?.total_hrs || 0;
              const gap    = leader - team.total_hrs;
              return (
                <tr
                  key={team.team_name}
                  className={`border-b border-[#2a2a2a] last:border-0 ${i === 0 ? 'bg-[#1a1a00]' : ''}`}
                >
                  <td className="px-4 py-2.5 text-[#888] text-xs">{rank}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: colorMap[team.team_name] }}
                    />
                    {team.team_name}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold">
                    {team.total_hrs}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[#888] text-xs hidden sm:table-cell">
                    {gap === 0 ? '—' : `-${gap}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
