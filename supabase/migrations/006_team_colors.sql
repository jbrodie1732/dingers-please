-- Migration 006 — Expose draft_position on team-facing views
-- Run in Supabase SQL editor after 005_preseason_hrs.sql
--
-- The web app assigns each team a fixed color for its whole lifetime by
-- indexing into a palette using team.draft_position (stable, unique, set
-- once pre-season) instead of hashing the team's UUID (which collided
-- constantly once there were 11 teams sharing a 15-color palette). These
-- two views are the only place the web app reads team info without also
-- joining the teams table directly, so they need draft_position added.
-- Logic is otherwise unchanged from migration 002.

DROP VIEW IF EXISTS team_standings;
DROP VIEW IF EXISTS daily_team_hrs;

CREATE VIEW team_standings AS
SELECT
  t.id             AS team_id,
  t.name           AS team_name,
  t.draft_position,
  COUNT(CASE WHEN
    (p.added_at   IS NULL OR hr.hit_at >= p.added_at) AND
    (p.dropped_at IS NULL OR hr.hit_at <  p.dropped_at)
  THEN hr.id END)::INT AS total_hrs
FROM teams t
LEFT JOIN players    p  ON p.team_id   = t.id
LEFT JOIN home_runs  hr ON hr.player_id = p.id
GROUP BY t.id, t.name, t.draft_position
ORDER BY total_hrs DESC;

CREATE VIEW daily_team_hrs AS
SELECT
  t.id             AS team_id,
  t.name           AS team_name,
  t.draft_position,
  hr.game_date,
  COUNT(hr.id)::INT AS daily_hrs
FROM teams t
JOIN players    p  ON p.team_id   = t.id
JOIN home_runs  hr ON hr.player_id = p.id
  AND (p.added_at   IS NULL OR hr.hit_at >= p.added_at)
  AND (p.dropped_at IS NULL OR hr.hit_at <  p.dropped_at)
GROUP BY t.id, t.name, t.draft_position, hr.game_date
ORDER BY hr.game_date ASC;
