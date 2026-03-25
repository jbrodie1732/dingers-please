-- Migration 003 — Web draft board support
-- Run in Supabase SQL editor

-- Draft order column on teams (1 = first pick, 10 = last)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS draft_position INT;

-- Enable realtime on players + draft_picks so the board updates live
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE draft_picks;
