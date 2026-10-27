-- Migration 006: the seeded event becomes PROM HALLOWEEN
--
-- The app shows the event name from this row after login. Adjust the date if
-- the party is not on 31 October 2026. The access code is unchanged (it was
-- hashed by migration 005); use the optional statement below to set a new one.

UPDATE events
SET name = 'PROM HALLOWEEN', date = '2026-10-31'
WHERE name = 'NYE Party 2026';

-- Optional: new access code for the event
-- UPDATE events
-- SET access_code_hash = extensions.crypt('your-new-code', extensions.gen_salt('bf'))
-- WHERE name = 'PROM HALLOWEEN';
