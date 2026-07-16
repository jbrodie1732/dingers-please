// web/src/lib/radar.ts
//
// Builds the data model behind the Rosters-page radar chart from the static
// per-player Statcast snapshot (playerStats.json) plus the live roster/team
// data pulled from Supabase at request time.
//
// Design notes:
//  - The seven metrics are all "higher = better".
//  - Each axis is scaled INDEPENDENTLY (per-variable min–max), because the
//    metrics live on wildly different units (mph vs. % vs. count). Scaling is
//    computed across the set of *team averages* (not the raw player pool), so
//    the best team on a given axis reaches the rim and the worst sits at the
//    center — this maximizes the visible separation between rosters, which is
//    the whole point of the chart.
//  - A team's value for a metric is the simple unweighted mean over the players
//    on its roster that actually have a value for that metric. Players missing
//    from the stats snapshot (e.g. the final picks before the workbook is
//    re-exported) are simply skipped for that metric — see `coverage`.

import statsData from './playerStats.json';

export type MetricDef = {
  key: string;
  label: string;
  fmt: 'num1' | 'num2' | 'pct';
};

type PlayerStatRow = { name: string } & Record<string, number | null | string>;

const METRICS = statsData.metrics as MetricDef[];
const PLAYERS = statsData.players as Record<string, PlayerStatRow>;

export function getMetrics(): MetricDef[] {
  return METRICS;
}

/** Format a raw metric value for display, per its `fmt`. */
export function formatMetric(value: number | null, fmt: MetricDef['fmt']): string {
  if (value == null || !Number.isFinite(value)) return '—';
  switch (fmt) {
    case 'pct':  return `${(value * 100).toFixed(1)}%`;
    case 'num2': return value.toFixed(2);
    case 'num1':
    default:     return value.toFixed(1);
  }
}

/** Look up a single player's stat row by MLB id. */
export function statsForMlbId(mlbId: number | null | undefined): PlayerStatRow | null {
  if (mlbId == null) return null;
  return PLAYERS[String(mlbId)] ?? null;
}

export type TeamRadar = {
  teamName: string;
  /** raw average per metric key (null if no rostered player had the metric) */
  averages: Record<string, number | null>;
  /** how many rostered players had usable stats vs. total on the roster */
  coverage: { withStats: number; total: number };
};

export type AxisModel = {
  key: string;
  label: string;
  fmt: MetricDef['fmt'];
  min: number;
  max: number;
  /** league (mean of all team averages) raw value + normalized 0..1 */
  leagueValue: number | null;
  leagueNorm: number;
};

export type RadarModel = {
  metrics: MetricDef[];
  /** team name -> its raw per-metric averages + coverage */
  teams: Record<string, TeamRadar>;
  /** per-axis bounds + league reference, aligned to `metrics` order */
  axes: AxisModel[];
};

// The worst team on an axis is lifted off dead-center to this fraction of the
// radius, so its shape stays legible instead of collapsing to a point. Purely
// visual — the raw values and the vs-league deltas are unaffected.
export const AXIS_FLOOR = 0.12;

/**
 * Normalize a raw value onto AXIS_FLOOR..1 for a given axis (per-variable
 * min–max, clamped). The floor keeps the worst team a small polygon rather than
 * a spike into the center.
 */
export function normalize(value: number | null, min: number, max: number): number {
  if (value == null || !Number.isFinite(value)) return AXIS_FLOOR;
  if (max <= min) return 0.5; // degenerate axis (all teams equal) -> mid-ring
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return AXIS_FLOOR + (1 - AXIS_FLOOR) * t;
}

type RosterPlayer = { player_id: string; team_name: string | null };

/**
 * Build the full radar model.
 * @param players       roster players (from player_standings) — needs player_id (uuid) + team_name
 * @param mlbIdByUuid   uuid -> mlb_player_id map (from the players table)
 */
export function buildRadarModel(
  players: RosterPlayer[],
  mlbIdByUuid: Record<string, number | null>
): RadarModel {
  // 1) group roster players by team, collect per-metric values
  const teamNames = Array.from(
    new Set(players.map(p => p.team_name).filter((n): n is string => !!n))
  );

  const teams: Record<string, TeamRadar> = {};

  for (const teamName of teamNames) {
    const roster = players.filter(p => p.team_name === teamName);
    const values: Record<string, number[]> = {};
    for (const m of METRICS) values[m.key] = [];

    let withStats = 0;
    for (const p of roster) {
      const stats = statsForMlbId(mlbIdByUuid[p.player_id]);
      if (!stats) continue;
      let counted = false;
      for (const m of METRICS) {
        const v = stats[m.key];
        if (typeof v === 'number' && Number.isFinite(v)) {
          values[m.key].push(v);
          counted = true;
        }
      }
      if (counted) withStats++;
    }

    const averages: Record<string, number | null> = {};
    for (const m of METRICS) {
      const arr = values[m.key];
      averages[m.key] = arr.length
        ? arr.reduce((a, b) => a + b, 0) / arr.length
        : null;
    }

    teams[teamName] = {
      teamName,
      averages,
      coverage: { withStats, total: roster.length },
    };
  }

  // 2) per-axis min/max across team averages + league mean
  const axes: AxisModel[] = METRICS.map(m => {
    const teamVals = Object.values(teams)
      .map(t => t.averages[m.key])
      .filter((v): v is number => v != null && Number.isFinite(v));

    const min = teamVals.length ? Math.min(...teamVals) : 0;
    const max = teamVals.length ? Math.max(...teamVals) : 1;
    const leagueValue = teamVals.length
      ? teamVals.reduce((a, b) => a + b, 0) / teamVals.length
      : null;

    return {
      key: m.key,
      label: m.label,
      fmt: m.fmt,
      min,
      max,
      leagueValue,
      leagueNorm: normalize(leagueValue, min, max),
    };
  });

  return { metrics: METRICS, teams, axes };
}
