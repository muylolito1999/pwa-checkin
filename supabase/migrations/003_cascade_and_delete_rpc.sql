-- Migration 003: cascading deletes + atomic "delete all event data" RPC
--
-- Apply in the Supabase SQL editor (or `supabase db push`) after 002.

-- Deleting an event or a guest must take its check-ins with it.
ALTER TABLE checkins DROP CONSTRAINT IF EXISTS checkins_event_id_fkey;
ALTER TABLE checkins
  ADD CONSTRAINT checkins_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

ALTER TABLE checkins DROP CONSTRAINT IF EXISTS checkins_guest_id_fkey;
ALTER TABLE checkins
  ADD CONSTRAINT checkins_guest_id_fkey
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE;

-- Wipes an event's guests and check-ins in a single transaction.
-- SECURITY INVOKER (the default): row level security applies to the caller.
CREATE OR REPLACE FUNCTION delete_event_data(p_event_id uuid)
RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
  DELETE FROM public.checkins WHERE event_id = p_event_id;
  DELETE FROM public.guests WHERE event_id = p_event_id;
$$;

REVOKE EXECUTE ON FUNCTION delete_event_data(uuid) FROM public;
GRANT EXECUTE ON FUNCTION delete_event_data(uuid) TO anon, authenticated;
