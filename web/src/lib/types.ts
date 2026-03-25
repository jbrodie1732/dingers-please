export type Team = {
  id:         string;
  name:       string;
  created_at: string;
};

export type Player = {
  id:            string;
  name:          string;
  team_id:       string | null;
  position:      string;
  mlb_player_id: number | null;
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

// 10 distinct team colors (assigned in standings order)
export const TEAM_COLORS = [
  '#f5c518',  // gold
  '#4ecdc4',  // teal
  '#ff6b6b',  // red
  '#a8e6cf',  // mint
  '#ff8b94',  // pink
  '#9b59b6',  // purple
  '#3498db',  // blue
  '#e67e22',  // orange
  '#2ecc71',  // green
  '#e74c3c',  // crimson
] as const;
