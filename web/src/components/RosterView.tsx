'use client';

import { useState } from 'react';
import type { PlayerStanding, TeamStanding } from '@/lib/types';
import { TEAM_COLORS } from '@/lib/types';

const POSITION_ORDER = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

interface Props {
  players:   PlayerStanding[];
  standings: TeamStanding[];
}

export default function RosterView({ players, standings }: Props) {
  const [selected, setSelected] = useState<string>(standings[0]?.team_name || '');

  const colorByTeam = Object.fromEntries(
    standings.map((t, i) => [t.team_name, TEAM_COLORS[i % TEAM_COLORS.length]])
  );

  const teamPlayers = players
    .filter(p => p.team_name === selected)
    .sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position));

  const teamTotal = standings.find(t => t.team_name === selected)?.total_hrs || 0;

  return (
    <div className="space-y-4">
      {/* Team selector */}
      <div className="flex flex-wrap gap-2">
        {standings.map((team, i) => (
          <button
            key={team.team_name}
            onClick={() => setSelected(team.team_name)}
            className={[
              'px-3 py-1.5 rounded text-sm transition-colors font-mono',
              selected === team.team_name
                ? 'font-semibold text-black'
                : 'bg-[#222] text-[#888] hover:text-white',
            ].join(' ')}
            style={
              selected === team.team_name
                ? { backgroundColor: TEAM_COLORS[i % TEAM_COLORS.length] }
                : {}
            }
          >
            {team.team_name}
            <span className={`ml-1.5 text-xs ${selected === team.team_name ? 'opacity-70' : 'text-[#555]'}`}>
              ({team.total_hrs})
            </span>
          </button>
        ))}
      </div>

      {/* Roster table */}
      {selected && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-lg overflow-hidden">
          <div
            className="px-4 py-3 border-b border-[#2a2a2a] flex items-center justify-between"
            style={{ borderTopColor: colorByTeam[selected], borderTopWidth: 2 }}
          >
            <span className="font-semibold">{selected}</span>
            <span className="text-[#f5c518] font-mono font-bold">{teamTotal} HRs</span>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#888] text-xs border-b border-[#2a2a2a]">
                <th className="text-left px-4 py-2">Pos</th>
                <th className="text-left px-4 py-2">Player</th>
                <th className="text-right px-4 py-2">HRs</th>
                <th className="text-right px-4 py-2 hidden sm:table-cell">Avg Dist</th>
                <th className="text-right px-4 py-2 hidden sm:table-cell">Long</th>
                <th className="text-right px-4 py-2 hidden md:table-cell">% of Team</th>
              </tr>
            </thead>
            <tbody>
              {teamPlayers.map(p => {
                const pct = teamTotal > 0 ? Math.round((p.total_hrs / teamTotal) * 100) : 0;
                return (
                  <tr key={p.player_id} className="border-b border-[#222] last:border-0 hover:bg-[#1c1c1c]">
                    <td className="px-4 py-2.5">
                      <span className="text-xs bg-[#222] text-[#aaa] rounded px-1.5 py-0.5">{p.position}</span>
                    </td>
                    <td className="px-4 py-2.5">{p.player_name}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-[#f5c518]">
                      {p.total_hrs}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#888] text-xs hidden sm:table-cell">
                      {p.avg_distance != null ? `${p.avg_distance} ft` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#888] text-xs hidden sm:table-cell">
                      {p.longest_hr != null ? `${p.longest_hr} ft` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs hidden md:table-cell">
                      <span className={pct >= 30 ? 'text-orange-400 font-semibold' : 'text-[#888]'}>
                        {teamTotal > 0 ? `${pct}%` : '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
