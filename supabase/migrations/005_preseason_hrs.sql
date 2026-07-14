-- Migration 005 — Pre-draft season HR reference stat
-- Run in Supabase SQL editor after 004_mlb_team.sql
--
-- Adds a column to store each player's real-season home run total as of the
-- data snapshot in data/dingers_player_data.xlsx (the "HR" column on the
-- MAIN tab). This is purely informational context for browsing the player
-- pool before/during the draft — it is NOT the same as `total_hrs` in the
-- team_standings/player_standings views, which only counts home runs hit
-- AFTER a player is drafted into this pool.

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS preseason_hrs INT DEFAULT 0;
