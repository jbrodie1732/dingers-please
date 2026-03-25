-- ============================================================
-- DINGER TRACKER — Supabase Schema
-- Run this in the Supabase SQL editor for your project
-- ============================================================

-- ---- Tables ------------------------------------------------

CREATE TABLE teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE players (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL UNIQUE,
  team_id        UUID REFERENCES teams(id) ON DELETE SET NULL,
  position       TEXT NOT NULL CHECK (position IN ('C','1B','2B','3B','SS','LF','CF','RF','DH')),
  mlb_player_id  INT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE home_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id           UUID NOT NULL REFERENCES players(id),
  game_pk             INT NOT NULL,
  at_bat_index        INT NOT NULL,
  batter_mlb_id       INT,
  distance            INT,
  launch_angle        NUMERIC(5,2),
  launch_speed        NUMERIC(5,2),
  spray_x             NUMERIC(8,4),
  spray_y             NUMERIC(8,4),
  mickey_meter_label  TEXT,
  mickey_meter_count  INT,
  game_date           DATE NOT NULL,
  hit_at              TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_pk, at_bat_index)
);

CREATE TABLE draft_picks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season        INT NOT NULL DEFAULT 2025,
  round         INT NOT NULL,
  pick_in_round INT NOT NULL,
  overall_pick  INT NOT NULL,
  player_id     UUID REFERENCES players(id),
  team_id       UUID NOT NULL REFERENCES teams(id),
  drafted_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season, overall_pick)
);

-- ---- Views -------------------------------------------------

-- Live standings: total HRs per team
CREATE VIEW team_standings AS
SELECT
  t.id        AS team_id,
  t.name      AS team_name,
  COUNT(hr.id)::INT AS total_hrs
FROM teams t
LEFT JOIN players p  ON p.team_id   = t.id
LEFT JOIN home_runs hr ON hr.player_id = p.id
GROUP BY t.id, t.name
ORDER BY total_hrs DESC;

-- Player leaderboard with distances array for avg calc
CREATE VIEW player_standings AS
SELECT
  p.id       AS player_id,
  p.name     AS player_name,
  p.position,
  t.name     AS team_name,
  COUNT(hr.id)::INT AS total_hrs,
  ARRAY_AGG(hr.distance ORDER BY hr.hit_at) FILTER (WHERE hr.distance IS NOT NULL) AS distances,
  ROUND(AVG(hr.distance)::NUMERIC, 1) AS avg_distance,
  MAX(hr.distance) AS longest_hr
FROM players p
LEFT JOIN teams t      ON t.id       = p.team_id
LEFT JOIN home_runs hr ON hr.player_id = p.id
GROUP BY p.id, p.name, p.position, t.name
ORDER BY total_hrs DESC;

-- Daily HR counts per team (used for timeline/cumulative chart)
CREATE VIEW daily_team_hrs AS
SELECT
  t.id        AS team_id,
  t.name      AS team_name,
  hr.game_date,
  COUNT(hr.id)::INT AS daily_hrs
FROM teams t
JOIN players p      ON p.team_id   = t.id
JOIN home_runs hr   ON hr.player_id = p.id
GROUP BY t.id, t.name, hr.game_date
ORDER BY hr.game_date ASC;

-- ---- Row-Level Security ------------------------------------

ALTER TABLE teams      ENABLE ROW LEVEL SECURITY;
ALTER TABLE players    ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_runs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks ENABLE ROW LEVEL SECURITY;

-- Public read (web dashboard uses anon key)
CREATE POLICY "Public read teams"       ON teams       FOR SELECT USING (true);
CREATE POLICY "Public read players"     ON players     FOR SELECT USING (true);
CREATE POLICY "Public read home_runs"   ON home_runs   FOR SELECT USING (true);
CREATE POLICY "Public read draft_picks" ON draft_picks FOR SELECT USING (true);

-- Watcher writes via service role key — no INSERT policies needed
-- (service role bypasses RLS automatically)

-- ---- Enable Realtime ---------------------------------------
-- Run this to enable realtime subscriptions on home_runs
-- (needed for live dashboard updates)
ALTER PUBLICATION supabase_realtime ADD TABLE home_runs;
