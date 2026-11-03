-- !!! DELETES ALL TEAMS, PLAYERS AND GAME HISTORY — FOR EVERY COACH !!!
-- This cannot be undone. Run it once, before (or after) neon/age-groups.sql,
-- to start the app from an empty slate. The access list (allowed_emails),
-- coaches' age groups and sign-in accounts are NOT touched.
--
-- Run it in the Neon Console → SQL Editor.

begin;
delete from public.games;
delete from public.players;
delete from public.teams;
commit;
