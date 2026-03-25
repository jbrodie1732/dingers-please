'use client';

import { useMemo, useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Customized } from 'recharts';
import type { HomeRun, TeamStanding } from '@/lib/types';
import { TEAM_COLORS } from '@/lib/types';

// Baseball field overlay rendered via Recharts Customized component.
// Receives chart layout props; draws in pixel space using the x/y scales.
function FieldBackground({ xAxisMap, yAxisMap }: Record<string, unknown>) {
  const xAxis = (xAxisMap as Record<string, { scale: (v: number) => number }>)?.[0];
  const yAxis = (yAxisMap as Record<string, { scale: (v: number) => number }>)?.[0];
  if (!xAxis?.scale || !yAxis?.scale) return null;
  const x = xAxis.scale;
  const y = yAxis.scale;
  return (
    <g opacity={0.18}>
      {/* Foul lines */}
      <line x1={x(125)} y1={y(199)} x2={x(25)}  y2={y(15)}  stroke="#888" strokeWidth="1" />
      <line x1={x(125)} y1={y(199)} x2={x(225)} y2={y(15)}  stroke="#888" strokeWidth="1" />
      {/* Outfield arc */}
      <path
        d={`M ${x(42)} ${y(90)} Q ${x(125)} ${y(10)} ${x(208)} ${y(90)}`}
        stroke="#888" strokeWidth="1" fill="none"
      />
      {/* Infield diamond */}
      <polygon
        points={`${x(125)},${y(175)} ${x(105)},${y(155)} ${x(125)},${y(135)} ${x(145)},${y(155)}`}
        stroke="#888" strokeWidth="1" fill="none"
      />
      {/* Home plate */}
      <circle cx={x(125)} cy={y(199)} r="4" fill="#888" />
    </g>
  );
}

interface Props {
  homeRuns: HomeRun[];
  standings: TeamStanding[];
}

export default function SprayChart({ homeRuns, standings }: Props) {
  const [selectedTeam, setSelectedTeam] = useState<string>('All');

  const teamNames   = standings.map(t => t.team_name);
  const colorByTeam = Object.fromEntries(
    standings.map((t, i) => [t.team_name, TEAM_COLORS[i % TEAM_COLORS.length]])
  );

  const filtered = useMemo(() => {
    const base = homeRuns.filter(hr => hr.spray_x != null && hr.spray_y != null);
    if (selectedTeam === 'All') return base;
    return base.filter(hr => hr.players?.teams?.name === selectedTeam);
  }, [homeRuns, selectedTeam]);

  const points = filtered.map(hr => ({
    x:        hr.spray_x!,
    y:        hr.spray_y!,
    distance: hr.distance,
    player:   hr.players?.name,
    team:     hr.players?.teams?.name,
    date:     hr.game_date,
    color:    colorByTeam[hr.players?.teams?.name || ''] || '#888',
  }));

  return (
    <div className="bg-[#161616] border border-[#2a2a2a] rounded-lg p-4 md:p-6 space-y-4">
      {/* Team filter */}
      <div className="flex flex-wrap gap-2">
        {['All', ...teamNames].map(name => (
          <button
            key={name}
            onClick={() => setSelectedTeam(name)}
            className={[
              'px-3 py-1 rounded text-xs transition-colors',
              selectedTeam === name
                ? 'bg-[#f5c518] text-black font-semibold'
                : 'bg-[#222] text-[#888] hover:text-white',
            ].join(' ')}
          >
            {name === 'All' ? 'All Teams' : name}
          </button>
        ))}
      </div>

      <div className="text-xs text-[#555]">
        Showing {points.length} home run{points.length !== 1 ? 's' : ''}
      </div>

      {/* Chart with field overlay */}
      <div className="relative" style={{ height: 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <XAxis
              type="number" dataKey="x"
              domain={[20, 230]} hide
            />
            <YAxis
              type="number" dataKey="y"
              domain={[10, 230]} hide reversed
            />
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-xs">
                    <div className="font-semibold">{d.player}</div>
                    <div className="text-[#888]">{d.team}</div>
                    {d.distance && <div className="text-[#f5c518]">{d.distance} ft</div>}
                    <div className="text-[#555]">{d.date}</div>
                  </div>
                );
              }}
            />
            <Customized component={FieldBackground} />
            <Scatter data={points} isAnimationActive={false}>
              {points.map((p, i) => (
                <Cell key={i} fill={p.color} fillOpacity={0.8} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
