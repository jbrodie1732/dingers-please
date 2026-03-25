'use client';

import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid, ReferenceLine,
} from 'recharts';
import type { DailyTeamHr, TeamStanding } from '@/lib/types';
import { TEAM_COLORS } from '@/lib/types';

interface Props {
  daily:     DailyTeamHr[];
  standings: TeamStanding[];
}

export default function HeadToHead({ daily, standings }: Props) {
  const teamNames = standings.map(t => t.team_name);
  const [teamA, setTeamA] = useState<string>(teamNames[0] || '');
  const [teamB, setTeamB] = useState<string>(teamNames[1] || '');

  const colorByTeam = Object.fromEntries(
    standings.map((t, i) => [t.team_name, TEAM_COLORS[i % TEAM_COLORS.length]])
  );

  const { chartData, totalA, totalB } = useMemo(() => {
    const dates  = Array.from(new Set(daily.map(r => r.game_date))).sort();
    let runA = 0;
    let runB = 0;
    const data = dates.map(date => {
      const dayRows = daily.filter(r => r.game_date === date);
      runA += dayRows.find(r => r.team_name === teamA)?.daily_hrs || 0;
      runB += dayRows.find(r => r.team_name === teamB)?.daily_hrs || 0;
      return {
        date,
        label: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        [teamA]: runA,
        [teamB]: runB,
      };
    });
    return { chartData: data, totalA: runA, totalB: runB };
  }, [daily, teamA, teamB]);

  const lead    = totalA > totalB ? teamA : totalB > totalA ? teamB : null;
  const deficit = Math.abs(totalA - totalB);

  function Select({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-[#222] border border-[#333] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#f5c518]"
      >
        {teamNames.map(n => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team pickers */}
      <div className="flex items-center justify-center gap-3">
        <Select value={teamA} onChange={setTeamA} />
        <span className="text-[#555] font-bold">vs</span>
        <Select value={teamB} onChange={setTeamB} />
      </div>

      {/* Summary cards */}
      {teamA && teamB && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { name: teamA, total: totalA, color: colorByTeam[teamA] },
            { name: teamB, total: totalB, color: colorByTeam[teamB] },
          ].map(({ name, total, color }) => (
            <div
              key={name}
              className="bg-[#161616] border rounded-lg p-4 text-center"
              style={{ borderColor: lead === name ? color : '#2a2a2a' }}
            >
              <div className="text-xs text-[#888]">{name}</div>
              <div className="text-3xl font-bold font-mono mt-1" style={{ color }}>
                {total}
              </div>
              <div className="text-xs text-[#555] mt-0.5">HRs</div>
            </div>
          ))}
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-lg p-4 text-center hidden sm:block">
            <div className="text-xs text-[#888]">Gap</div>
            <div className="text-3xl font-bold font-mono mt-1 text-[#f5c518]">
              {deficit}
            </div>
            <div className="text-xs text-[#555] mt-0.5">
              {lead ? `${lead} leads` : 'Tied'}
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-lg p-4 md:p-6" style={{ height: 360 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 24, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="#222" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#888', fontSize: 10 }}
                axisLine={false} tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#888', fontSize: 11 }}
                axisLine={false} tickLine={false} width={30}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-xs">
                      <div className="text-[#f5c518] font-semibold mb-1">{label}</div>
                      {payload.map(p => (
                        <div key={p.dataKey} className="flex justify-between gap-6 py-0.5">
                          <span style={{ color: p.color }}>{p.dataKey}</span>
                          <span className="font-mono">{p.value}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone" dataKey={teamA}
                stroke={colorByTeam[teamA]} strokeWidth={2.5}
                dot={false} activeDot={{ r: 4 }}
              />
              <Line
                type="monotone" dataKey={teamB}
                stroke={colorByTeam[teamB]} strokeWidth={2.5}
                dot={false} activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {chartData.length === 0 && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-lg p-12 text-center text-[#555]">
          No data yet.
        </div>
      )}
    </div>
  );
}
