-- Migration 007 — Injury status (IL tiers)
-- Run in Supabase SQL editor after 006_team_colors.sql
--
-- Adds columns to store each player's current injury status, sourced from
-- the "injuries" tab of data/dingers_player_data.xlsx (matched by
-- players.mlb_player_id against the tab's "Player ID" column). If a player
-- is not on that tab, they are not injured — il_status stays NULL.
--
-- This is purely informational display context for the Player Pool and
-- Draft Room pages (small emoji + hover tooltip next to the player's name).
-- It has no bearing on scoring/standings and is refreshed by re-running the
-- injuries load script whenever the "injuries" tab is updated.

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS il_status      TEXT, -- '7-Day IL' | '10-Day IL' | '60-Day IL' | NULL (not injured)
  ADD COLUMN IF NOT EXISTS injury_detail  TEXT, -- e.g. "Strained calf" / "Shoulder surgery (torn labrum)"
  ADD COLUMN IF NOT EXISTS injury_update  TEXT; -- e.g. "No timetable for return" / "Rehab assignment (6/30)"
