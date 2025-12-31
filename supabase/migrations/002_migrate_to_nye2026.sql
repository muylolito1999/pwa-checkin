-- Migration: NYE 2025 -> NYE 2026
-- This script deletes old event data and creates new NYE 2026 event

-- Delete all checkins (cascades from events)
DELETE FROM checkins
WHERE event_id IN (
  SELECT id FROM events WHERE access_code IN ('nye2025', '20256')
);

-- Delete all guests (cascades from events)
DELETE FROM guests
WHERE event_id IN (
  SELECT id FROM events WHERE access_code IN ('nye2025', '20256')
);

-- Delete old events
DELETE FROM events
WHERE access_code IN ('nye2025', '20256');

-- Insert new NYE 2026 event
INSERT INTO events (name, date, access_code)
VALUES ('NYE Party 2026', '2026-12-31', 'nye2026');
