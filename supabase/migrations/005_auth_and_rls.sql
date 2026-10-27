-- Migration 005: real authentication + row level security
--
-- PREREQUISITE: enable "Anonymous sign-ins" in Supabase Dashboard
--               -> Authentication -> Sign In / Providers.
--
-- Model: every device signs in anonymously once. Calling join_event() with the
-- event's access code records a membership; all data access is restricted to
-- members of the event. The public anon key alone can no longer read anything.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Access codes are stored hashed (bcrypt) and never returned to clients.
ALTER TABLE events ADD COLUMN IF NOT EXISTS access_code_hash text;
UPDATE events
SET access_code_hash = extensions.crypt(access_code, extensions.gen_salt('bf'))
WHERE access_code IS NOT NULL AND access_code_hash IS NULL;
ALTER TABLE events DROP COLUMN IF EXISTS access_code;

-- 2. Membership: which auth users (one anonymous user per device) joined which event.
CREATE TABLE IF NOT EXISTS event_members (
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id  uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_event_members_event ON event_members(event_id);

ALTER TABLE event_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_members_select_own ON event_members;
CREATE POLICY event_members_select_own ON event_members
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- 3. Joining an event is the only way to gain membership.
CREATE OR REPLACE FUNCTION join_event(p_event_id uuid, p_code text DEFAULT NULL)
RETURNS TABLE (id uuid, name text, date date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid  uuid := (SELECT auth.uid());
  v_hash text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
  END IF;

  SELECT e.access_code_hash INTO v_hash FROM public.events e WHERE e.id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_hash IS NOT NULL AND (p_code IS NULL OR v_hash <> crypt(p_code, v_hash)) THEN
    RAISE EXCEPTION 'Invalid access code' USING ERRCODE = '28P01';
  END IF;

  INSERT INTO public.event_members (user_id, event_id)
  VALUES (v_uid, p_event_id)
  ON CONFLICT DO NOTHING;

  RETURN QUERY SELECT e.id, e.name, e.date FROM public.events e WHERE e.id = p_event_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION join_event(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION join_event(uuid, text) TO authenticated;

-- 4. Replace the allow-all policies with membership-based ones.
DROP POLICY IF EXISTS "Allow all access to events"   ON events;
DROP POLICY IF EXISTS "Allow all access to guests"   ON guests;
DROP POLICY IF EXISTS "Allow all access to checkins" ON checkins;

REVOKE ALL ON events, guests, checkins FROM anon;
REVOKE ALL ON events FROM authenticated;
-- Column-level grant: the hash column is never readable through the API.
GRANT SELECT (id, name, date, settings, created_at, updated_at) ON events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON guests, checkins TO authenticated;

CREATE POLICY events_select_member ON events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM event_members m
    WHERE m.event_id = events.id AND m.user_id = (SELECT auth.uid())
  ));

CREATE POLICY guests_select_member ON guests
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM event_members m WHERE m.event_id = guests.event_id AND m.user_id = (SELECT auth.uid())));
CREATE POLICY guests_insert_member ON guests
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM event_members m WHERE m.event_id = guests.event_id AND m.user_id = (SELECT auth.uid())));
CREATE POLICY guests_update_member ON guests
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM event_members m WHERE m.event_id = guests.event_id AND m.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM event_members m WHERE m.event_id = guests.event_id AND m.user_id = (SELECT auth.uid())));
CREATE POLICY guests_delete_member ON guests
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM event_members m WHERE m.event_id = guests.event_id AND m.user_id = (SELECT auth.uid())));

CREATE POLICY checkins_select_member ON checkins
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM event_members m WHERE m.event_id = checkins.event_id AND m.user_id = (SELECT auth.uid())));
CREATE POLICY checkins_insert_member ON checkins
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM event_members m WHERE m.event_id = checkins.event_id AND m.user_id = (SELECT auth.uid())));
CREATE POLICY checkins_update_member ON checkins
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM event_members m WHERE m.event_id = checkins.event_id AND m.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM event_members m WHERE m.event_id = checkins.event_id AND m.user_id = (SELECT auth.uid())));
CREATE POLICY checkins_delete_member ON checkins
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM event_members m WHERE m.event_id = checkins.event_id AND m.user_id = (SELECT auth.uid())));

-- 5. The wipe RPC is for members only (RLS applies inside it).
REVOKE EXECUTE ON FUNCTION delete_event_data(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION delete_event_data(uuid) TO authenticated;

-- Housekeeping (run occasionally): anonymous users are never cleaned up automatically.
-- DELETE FROM auth.users WHERE is_anonymous IS TRUE AND created_at < now() - interval '90 days';
