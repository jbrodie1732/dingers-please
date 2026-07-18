-- 008_alert_sent.sql
-- Durable iMessage alert delivery.
--
-- Previously an alert was fire-and-forget right after the home_runs insert. If
-- the watcher process died (or a second watcher won the insert race) between
-- the insert and the send, the row landed in the DB but no text ever went out —
-- and because the watcher rebuilds its in-memory "seen" set from the DB on
-- startup, that HR was then marked seen and never retried. Result: HR on the
-- site, no alert, ever.
--
-- This column lets the watcher track whether the alert actually went out, so a
-- catch-up sweep can (re)send any home run that hasn't been alerted yet —
-- surviving restarts and transient Messages failures.

ALTER TABLE home_runs
  ADD COLUMN IF NOT EXISTS alert_sent BOOLEAN NOT NULL DEFAULT false;

-- Backfill: every home run that already exists predates this feature. Mark them
-- all sent so the catch-up sweep doesn't retroactively text the entire season's
-- history the first time the updated watcher runs. From here on, new inserts
-- default to false and get flipped to true only after a confirmed send.
UPDATE home_runs SET alert_sent = true WHERE alert_sent = false;

-- Partial index to make the catch-up sweep's "unsent" lookup cheap.
CREATE INDEX IF NOT EXISTS home_runs_unsent_idx
  ON home_runs (hit_at)
  WHERE alert_sent = false;
