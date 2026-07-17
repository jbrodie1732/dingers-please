export type Team = {
  id:             string;
  name:           string;
  draft_position: number | null;
  created_at:     string;
};

export type Player = {
  id:            string;
  name:          string;
  team_id:       string | null;
  position:      string;
  mlb_player_id: number | null;
  mlb_team?:     string | null;
  il_status?:     string | null;
  injury_detail?: string | null;
  injury_update?: string | null;
  created_at:    string;
  teams?:        Team;
};

export type HomeRun = {
  id:                 string;
  player_id:          string;
  game_pk:            number;
  at_bat_index:       number;
  batter_mlb_id:      number | null;
  distance:           number | null;
  launch_angle:       number | null;
  launch_speed:       number | null;
  spray_x:            number | null;
  spray_y:            number | null;
  mickey_meter_label: string | null;
  mickey_meter_count: number | null;
  game_date:          string;
  hit_at:             string;
  created_at:         string;
  players?: Player & { teams?: Team };
};

export type TeamStanding = {
  team_id:        string;
  team_name:      string;
  total_hrs:      number;
  draft_position: number | null;
};

export type PlayerStanding = {
  player_id:   string;
  player_name: string;
  position:    string;
  team_name:   string;
  total_hrs:   number;
  distances:   number[] | null;
  avg_distance: number | null;
  longest_hr:   number | null;
};

export type DailyTeamHr = {
  team_id:        string;
  team_name:      string;
  game_date:      string;
  daily_hrs:      number;
  draft_position: number | null;
};

export type DraftPick = {
  id:           string;
  season:       number;
  round:        number;
  pick_in_round: number;
  overall_pick: number;
  player_id:    string;
  team_id:      string;
  drafted_at:   string;
  players?:     Player;
  teams?:       Team;
};

// Mickey Meter tier, keyed off how many of the 30 parks the ball clears.
// Derived from the count (not the stored label) so historical rows re-tier
// automatically and the site always matches the current scheme. Keep these
// boundaries in sync with src/watcher/alerts.js getDongLabel().
export type MickeyTone = 'clubhouse' | 'mickey' | 'kinda' | 'legit';

export function mickeyTier(count: number | null | undefined): { label: string; tone: MickeyTone } {
  if (count == null) return { label: '—', tone: 'mickey' };
  if (count < 10)  return { label: 'the whole fuckin clubhouse', tone: 'clubhouse' };
  if (count <= 19) return { label: 'mickey mouse', tone: 'mickey' };
  if (count <= 23) return { label: 'kinda mickey mouse', tone: 'kinda' };
  return { label: 'okay kinda legit', tone: 'legit' };
}

// 11 team colors (one per current team). Naive evenly-spaced hues turned out
// not to be good enough — human color perception isn't uniform around the
// hue wheel, and the green/cyan and blue/violet ranges compress a lot more
// than red/orange does, so even hues spaced ~28° apart in that region still
// read as "the same green." These were chosen and verified by converting to
// CIE Lab space and checking actual perceptual distance between every pair
// (all pairs are >=22 apart in Lab, comfortably distinguishable) — that's
// why the gaps look uneven if you eyeball the hue values below. Also kept
// clear of the semantic UI colors (--c-accent gold, --c-foul red,
// --c-legit green, --c-mickey orange) so a team chip is never mistaken for
// a status color. If the league grows past 11 teams, add a 12th here, but
// verify pairwise distance again rather than just eyeballing a new hue —
// this palette is already fairly tightly packed for how few "safe,
// distinct" zones the color wheel actually has.
export const TEAM_COLORS = [
  '#e23c73', // crimson       (h340)
  '#7e2531', // maroon        (h352, deliberately dark/muted — distinguished from crimson by lightness, not hue)
  '#e2923c', // orange        (h31)
  '#b8e23c', // chartreuse    (h75)
  '#68da2f', // green         (h100)
  '#26d9ac', // teal          (h165)
  '#40b6dd', // cyan          (h195)
  '#496edf', // blue          (h225)
  '#7654de', // indigo        (h255)
  '#c754de', // violet        (h290)
  '#e147ae', // magenta       (h320)
] as const;

// Deterministic fallback for the rare case a caller doesn't have the
// team's draft_position on hand. Kept only for safety/back-compat — it can
// still collide once there are more teams than colors, which is exactly
// why every call site should prefer passing draftPosition below.
function hashColor(teamId: string): string {
  let hash = 0;
  for (let i = 0; i < teamId.length; i++) {
    hash = ((hash << 5) - hash) + teamId.charCodeAt(i);
    hash |= 0;
  }
  return TEAM_COLORS[Math.abs(hash) % TEAM_COLORS.length];
}

/**
 * A team's color is keyed off its stable `draft_position` (1..N, set once
 * pre-season from config/draft.config.js and never regenerated) rather than
 * its database UUID. Indexing directly by position guarantees zero
 * collisions for up to TEAM_COLORS.length teams and — crucially — the same
 * team gets the same color on every page, every season, even across a
 * draft reset (which mints new team UUIDs but preserves draft_position).
 */
export function getTeamColor(teamId: string, draftPosition?: number | null): string {
  if (draftPosition != null && Number.isFinite(draftPosition) && draftPosition >= 1) {
    return TEAM_COLORS[(draftPosition - 1) % TEAM_COLORS.length];
  }
  return hashColor(teamId);
}
