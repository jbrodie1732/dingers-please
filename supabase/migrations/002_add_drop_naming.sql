-- ============================================================
-- Migration 002 — Add/drop system + naming + admin support
-- Run this in the Supabase SQL editor after 001 (schema.sql)
-- ============================================================

-- ---- 1. Player columns for naming and transaction tracking ----

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS mlb_player_id    INT,           -- numeric MLB API player ID (most reliable match key)
  ADD COLUMN IF NOT EXISTS mlb_api_name     TEXT,          -- override: exact name as MLB API returns it (if different from draft name)
  ADD COLUMN IF NOT EXISTS added_at         TIMESTAMPTZ,   -- null = original draft pick; set when added mid-season
  ADD COLUMN IF NOT EXISTS dropped_at       TIMESTAMPTZ;   -- null = still active; set when dropped mid-season

-- Index for fast ID-based lookups in the watcher
CREATE INDEX IF NOT EXISTS players_mlb_player_id_idx ON players(mlb_player_id);

-- ---- 2. Season config (admin-editable) ----

CREATE TABLE IF NOT EXISTS season_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season          INT  NOT NULL UNIQUE,
  add_drop_limit  INT  NOT NULL DEFAULT 2,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Default config for 2026
INSERT INTO season_config (season, add_drop_limit)
VALUES (2026, 2)
ON CONFLICT (season) DO NOTHING;

ALTER TABLE season_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read season_config" ON season_config FOR SELECT USING (true);

-- ---- 3. Transactions table ----
-- Records every add/drop. The dropped player keeps their team_id and all prior HRs;
-- the added player's HRs only count from effective_at onward.

CREATE TABLE IF NOT EXISTS transactions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season             INT          NOT NULL DEFAULT 2026,
  team_id            UUID         NOT NULL REFERENCES teams(id),
  dropped_player_id  UUID         NOT NULL REFERENCES players(id),
  added_player_id    UUID         REFERENCES players(id),   -- null until replacement is named
  effective_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  notes              TEXT,
  created_at         TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read transactions" ON transactions FOR SELECT USING (true);

-- ---- 4. Update views to respect added_at / dropped_at windows ----
-- A HR counts for a team iff:
--   hit_at >= player.added_at  (or added_at is null = drafted from day 1)
--   hit_at <  player.dropped_at (or dropped_at is null = still active)

DROP VIEW IF EXISTS player_standings;
DROP VIEW IF EXISTS team_standings;
DROP VIEW IF EXISTS daily_team_hrs;

CREATE VIEW team_standings AS
SELECT
  t.id   AS team_id,
  t.name AS team_name,
  COUNT(CASE WHEN
    (p.added_at   IS NULL OR hr.hit_at >= p.added_at) AND
    (p.dropped_at IS NULL OR hr.hit_at <  p.dropped_at)
  THEN hr.id END)::INT AS total_hrs
FROM teams t
LEFT JOIN players    p  ON p.team_id   = t.id
LEFT JOIN home_runs  hr ON hr.player_id = p.id
GROUP BY t.id, t.name
ORDER BY total_hrs DESC;

CREATE VIEW player_standings AS
SELECT
  p.id        AS player_id,
  p.name      AS player_name,
  p.position,
  t.name      AS team_name,
  (p.dropped_at IS NOT NULL) AS is_dropped,
  p.added_at,
  p.dropped_at,
  COUNT(CASE WHEN
    (p.added_at   IS NULL OR hr.hit_at >= p.added_at) AND
    (p.dropped_at IS NULL OR hr.hit_at <  p.dropped_at)
  THEN hr.id END)::INT AS total_hrs,
  ARRAY_AGG(hr.distance ORDER BY hr.hit_at) FILTER (WHERE
    hr.distance IS NOT NULL AND
    (p.added_at   IS NULL OR hr.hit_at >= p.added_at) AND
    (p.dropped_at IS NULL OR hr.hit_at <  p.dropped_at)
  ) AS distances,
  ROUND(AVG(CASE WHEN
    (p.added_at   IS NULL OR hr.hit_at >= p.added_at) AND
    (p.dropped_at IS NULL OR hr.hit_at <  p.dropped_at)
  THEN hr.distance END)::NUMERIC, 1) AS avg_distance,
  MAX(CASE WHEN
    (p.added_at   IS NULL OR hr.hit_at >= p.added_at) AND
    (p.dropped_at IS NULL OR hr.hit_at <  p.dropped_at)
  THEN hr.distance END) AS longest_hr
FROM players p
LEFT JOIN teams      t  ON t.id        = p.team_id
LEFT JOIN home_runs  hr ON hr.player_id = p.id
GROUP BY p.id, p.name, p.position, t.name, p.dropped_at, p.added_at
ORDER BY total_hrs DESC;

CREATE VIEW daily_team_hrs AS
SELECT
  t.id   AS team_id,
  t.name AS team_name,
  hr.game_date,
  COUNT(hr.id)::INT AS daily_hrs
FROM teams t
JOIN players    p  ON p.team_id   = t.id
JOIN home_runs  hr ON hr.player_id = p.id
  AND (p.added_at   IS NULL OR hr.hit_at >= p.added_at)
  AND (p.dropped_at IS NULL OR hr.hit_at <  p.dropped_at)
GROUP BY t.id, t.name, hr.game_date
ORDER BY hr.game_date ASC;
