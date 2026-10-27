-- Migration 004: server-authoritative timestamps + indexes for incremental pulls
--
-- Devices pull rows changed since a watermark. Timestamps written by device
-- clocks made late-pushed offline changes invisible to other devices, so the
-- client no longer sends created_at/updated_at and the database owns them.

-- Guests: updated_at is set on INSERT as well as UPDATE.
DROP TRIGGER IF EXISTS update_guests_updated_at ON guests;
CREATE TRIGGER update_guests_updated_at
  BEFORE INSERT OR UPDATE ON guests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Check-ins: created_at is the pull watermark column, so it must be server time.
CREATE OR REPLACE FUNCTION set_created_at_now()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.created_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS checkins_created_at ON checkins;
CREATE TRIGGER checkins_created_at
  BEFORE INSERT ON checkins
  FOR EACH ROW
  EXECUTE FUNCTION set_created_at_now();

-- Pulls are ordered by (timestamp, id) and paginated.
CREATE INDEX IF NOT EXISTS idx_guests_event_updated ON guests(event_id, updated_at, id);
CREATE INDEX IF NOT EXISTS idx_checkins_event_created ON checkins(event_id, created_at, id);
