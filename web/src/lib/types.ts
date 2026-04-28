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
  team_id:   string;
  team_name: string;
  total_hrs: number;
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
  team_id:   string;
  team_name: string;
  game_date: string;
  daily_hrs: number;
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

// 15 team colors — deterministically assigned by team ID hash, not standings rank
export const TEAM_COLORS = [
  '#E8502A', '#3B82F6', '#F59E0B', '#10B981', '#EC4899',
  '#8B5CF6', '#06B6D4', '#F97316', '#84CC16', '#EF4444',
  '#14B8A6', '#D946EF', '#FB923C', '#A3E635', '#60A5FA',
] as const;

export function getTeamColor(teamId: string): string {
  let hash = 0;
  for (let i = 0; i < teamId.length; i++) {
    hash = ((hash << 5) - hash) + teamId.charCodeAt(i);
    hash |= 0;
  }
  return TEAM_COLORS[Math.abs(hash) % TEAM_COLORS.length];
}
