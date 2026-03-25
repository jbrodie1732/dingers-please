-- Add mlb_team column to players so the player pool page can show team abbreviations
ALTER TABLE players ADD COLUMN IF NOT EXISTS mlb_team TEXT;
