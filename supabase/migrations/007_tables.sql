-- Migration 007: tables (group reservations) + arrivals log
--
-- A table is a reservation like "Marco, 10 seats". Arrivals are an append-only
-- log of signed deltas (+5 arrived, -1 correction): the number of people at a
-- table is the sum, so concurrent offline increments from several devices
-- never overwrite each other. Both tables follow the guests/checkins pattern:
-- server-owned timestamps (004) and membership-based row level security (005).
--
-- Apply in the Supabase SQL editor (or `supabase db push`) after 006, BEFORE
-- deploying the app version that uses tables.

-- 1. Tables: mutable, soft-deleted (other devices learn about removals via pull).
CREATE TABLE IF NOT EXISTS event_tables (
  id         uuid PRIMARY KEY,
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (length(btrim(name)) > 0),
  seats      integer NOT NULL CHECK (seats > 0),
  notes      text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Arrivals: immutable log; created_at is the pull watermark column.
CREATE TABLE IF NOT EXISTS table_arrivals (
  id         uuid PRIMARY KEY,
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  table_id   uuid NOT NULL REFERENCES event_tables(id) ON DELETE CASCADE,
  delta      integer NOT NULL CHECK (delta <> 0),
  arrived_at timestamptz NOT NULL,
  device_id  text NOT NULL,
  synced_at  timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Timestamps are set by the database, never by device clocks (see 004).
DROP TRIGGER IF EXISTS event_tables_updated_at ON event_tables;
CREATE TRIGGER event_tables_updated_at
  BEFORE INSERT OR UPDATE ON event_tables
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS table_arrivals_created_at ON table_arrivals;
CREATE TRIGGER table_arrivals_created_at
  BEFORE INSERT ON table_arrivals
  FOR EACH ROW
  EXECUTE FUNCTION set_created_at_now();

-- 4. Pulls are ordered by (timestamp, id) and paginated.
CREATE INDEX IF NOT EXISTS idx_event_tables_event_updated ON event_tables(event_id, updated_at, id);
CREATE INDEX IF NOT EXISTS idx_table_arrivals_event_created ON table_arrivals(event_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_table_arrivals_table ON table_arrivals(event_id, table_id);

-- 5. Row level security: members of the event only (same policies as 005).
ALTER TABLE event_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_arrivals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON event_tables, table_arrivals FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_tables, table_arrivals TO authenticated;

DROP POLICY IF EXISTS event_tables_select_member ON event_tables;
DROP POLICY IF EXISTS event_tables_insert_member ON event_tables;
DROP POLICY IF EXISTS event_tables_update_member ON event_tables;
DROP POLICY IF EXISTS event_tables_delete_member ON event_tables;

CREATE POLICY event_tables_select_member ON event_tables
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM event_members m WHERE m.event_id = event_tables.event_id AND m.user_id = (SELECT auth.uid())));
CREATE POLICY event_tables_insert_member ON event_tables
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM event_members m WHERE m.event_id = event_tables.event_id AND m.user_id = (SELECT auth.uid())));
CREATE POLICY event_tables_update_member ON event_tables
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM event_members m WHERE m.event_id = event_tables.event_id AND m.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM event_members m WHERE m.event_id = event_tables.event_id AND m.user_id = (SELECT auth.uid())));
CREATE POLICY event_tables_delete_member ON event_tables
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM event_members m WHERE m.event_id = event_tables.event_id AND m.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS table_arrivals_select_member ON table_arrivals;
DROP POLICY IF EXISTS table_arrivals_insert_member ON table_arrivals;
DROP POLICY IF EXISTS table_arrivals_update_member ON table_arrivals;
DROP POLICY IF EXISTS table_arrivals_delete_member ON table_arrivals;

CREATE POLICY table_arrivals_select_member ON table_arrivals
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM event_members m WHERE m.event_id = table_arrivals.event_id AND m.user_id = (SELECT auth.uid())));
CREATE POLICY table_arrivals_insert_member ON table_arrivals
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM event_members m WHERE m.event_id = table_arrivals.event_id AND m.user_id = (SELECT auth.uid())));
CREATE POLICY table_arrivals_update_member ON table_arrivals
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM event_members m WHERE m.event_id = table_arrivals.event_id AND m.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM event_members m WHERE m.event_id = table_arrivals.event_id AND m.user_id = (SELECT auth.uid())));
CREATE POLICY table_arrivals_delete_member ON table_arrivals
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM event_members m WHERE m.event_id = table_arrivals.event_id AND m.user_id = (SELECT auth.uid())));

-- 6. "Delete all server data" wipes tables and arrivals too (SECURITY INVOKER: RLS applies).
CREATE OR REPLACE FUNCTION delete_event_data(p_event_id uuid)
RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
  DELETE FROM public.table_arrivals WHERE event_id = p_event_id;
  DELETE FROM public.event_tables   WHERE event_id = p_event_id;
  DELETE FROM public.checkins       WHERE event_id = p_event_id;
  DELETE FROM public.guests         WHERE event_id = p_event_id;
$$;

REVOKE EXECUTE ON FUNCTION delete_event_data(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION delete_event_data(uuid) TO authenticated;
