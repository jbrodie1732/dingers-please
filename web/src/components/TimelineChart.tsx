'use client';

import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { DailyTeamHr } from '@/lib/types';
import { TEAM_COLORS } from '@/lib/types';

interface Props {
  dailyData: DailyTeamHr[];
}

export default function TimelineChart({ dailyData }: Props) {
  const { chartData, teams } = useMemo(() => {
    // Get sorted unique teams (by total HRs)
    const teamTotals: Record<string, number> = {};
    for (const row of dailyData) {
      teamTotals[row.team_name] = (teamTotals[row.team_name] || 0) + row.daily_hrs;
    }
    const teams = Object.entries(teamTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    // Get all dates in order
    const dates = Array.from(new Set(dailyData.map(r => r.game_date))).sort();

    // Build running cumulative per team
    const running: Record<string, number> = Object.fromEntries(teams.map(t => [t, 0]));
    const chartData = dates.map(date => {
      const dayRows = dailyData.filter(r => r.game_date === date);
      for (const row of dayRows) {
        running[row.team_name] = (running[row.team_name] || 0) + row.daily_hrs;
      }
      return {
        date,
        label: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ...Object.fromEntries(teams.map(t => [t, running[t]])),
      };
    });

    return { chartData, teams };
  }, [dailyData]);

  if (chartData.length === 0) {
    return (
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-lg p-12 text-center text-[#555]">
        No data yet — check back after the first games.
      </div>
    );
  }

  return (
    <div className="bg-[#161616] border border-[#2a2a2a] rounded-lg p-4 md:p-6">
      <div style={{ height: 440 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 24, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="#222" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#888', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#888', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const sorted = [...payload].sort((a, b) => (b.value as number) - (a.value as number));
                return (
                  <div className="bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-xs max-h-56 overflow-y-auto">
                    <div className="font-semibold text-[#f5c518] mb-1.5">{label}</div>
                    {sorted.map(p => (
                      <div key={p.dataKey} className="flex justify-between gap-4 py-0.5">
                        <span style={{ color: p.color }}>{p.dataKey}</span>
                        <span className="font-mono">{p.value}</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: 12, fontSize: 11 }}
              formatter={(value) => <span style={{ color: '#aaa' }}>{value}</span>}
            />
            {teams.map((team, i) => (
              <Line
                key={team}
                type="monotone"
                dataKey={team}
                stroke={TEAM_COLORS[i % TEAM_COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
