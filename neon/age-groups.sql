-- Age groups: the admin assigns coaches to age groups (U6–U18, Seniors), and
-- every coach in an age group can see, create, edit and delete all teams in it.
-- Run this in the Neon Console → SQL Editor AFTER schema.sql, allowlist.sql and
-- admin.sql (and require-verified-email.sql on older projects). Safe to re-run.
--
-- To start with an empty slate first, run neon/reset-data.sql.
--
-- How access works after this script:
--   * teams    — visible/editable to the admin, and to coaches assigned to the
--                team's age group. A coach can only create a team in, or move
--                a team to, one of their own age groups.
--   * players  — follow their team (unchanged).
--   * games    — follow their team. A game with no team (e.g. one whose team
--                was deleted) stays visible only to whoever recorded it.
--   * coach_age_groups — the admin manages it; coaches can read their own rows
--                (so the app knows which age groups to offer).

-- ============ AGE GROUPS ============

-- The fixed list. To add one (e.g. U19), extend this check constraint AND
-- AGE_GROUPS in src/constants.ts.
create or replace function public.is_valid_age_group(ag text)
returns boolean
language sql
immutable
as $$
  select ag in ('U6','U7','U8','U9','U10','U11','U12','U13','U14','U15','U16','U17','U18','Seniors');
$$;

create table if not exists public.coach_age_groups (
  email text not null references public.allowed_emails(email) on delete cascade on update cascade,
  age_group text not null check (public.is_valid_age_group(age_group)),
  added_at timestamptz not null default now(),
  primary key (email, age_group)
);

create index if not exists idx_coach_age_groups_age_group on public.coach_age_groups(age_group);

alter table public.teams add column if not exists age_group text;
alter table public.teams drop constraint if exists teams_age_group_valid;
alter table public.teams add constraint teams_age_group_valid
  check (age_group is null or public.is_valid_age_group(age_group));
create index if not exists idx_teams_age_group on public.teams(age_group);

-- ============ ACCESS CHECK ============

-- True for the admin, or for a signed-in coach (verified email, on the access
-- list) who is assigned to this age group. SECURITY DEFINER so it can read
-- coach_age_groups and neon_auth regardless of the caller's grants.
create or replace function public.can_access_age_group(ag text)
returns boolean
language sql
stable
security definer
set search_path = public, neon_auth
as $$
  select ag is not null and public.is_allowed() and (
    public.is_admin()
    or exists (
      select 1
      from public.coach_age_groups c
      where c.age_group = ag
        and lower(c.email) = lower(coalesce(public.current_email(), ''))
    )
  );
$$;

grant execute on function public.can_access_age_group(text) to authenticated;
grant execute on function public.is_valid_age_group(text) to authenticated;

-- ============ POLICIES ============

-- COACH_AGE_GROUPS: admin manages; coaches read their own assignments.
alter table public.coach_age_groups enable row level security;
grant select, insert, update, delete on public.coach_age_groups to authenticated;

drop policy if exists coach_age_groups_read on public.coach_age_groups;
create policy coach_age_groups_read on public.coach_age_groups for select to authenticated
  using (
    (select public.is_admin())
    or lower(email) = lower(coalesce((select public.current_email()), ''))
  );

drop policy if exists coach_age_groups_write on public.coach_age_groups;
create policy coach_age_groups_write on public.coach_age_groups for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- TEAMS: shared by everyone in the team's age group. Teams without an age
-- group (from before this script) are visible to the admin only.
drop policy if exists team_access on public.teams;
create policy team_access on public.teams for all to authenticated
  using (
    public.can_access_age_group(age_group)
    or (age_group is null and (select public.is_admin()))
  )
  with check (public.can_access_age_group(age_group));

-- PLAYERS: unchanged in spirit — visible iff the parent team is visible
-- (the subquery runs under the teams policy above).
drop policy if exists player_access on public.players;
create policy player_access on public.players for all to authenticated
  using (
    (select public.is_allowed())
    and exists (select 1 from public.teams t where t.id = players.team_id)
  )
  with check (
    (select public.is_allowed())
    and exists (select 1 from public.teams t where t.id = players.team_id)
  );

-- GAMES: shared through their team; games without a team stay private.
drop policy if exists game_access on public.games;
create policy game_access on public.games for all to authenticated
  using (
    (select public.is_allowed()) and (
      (team_id is not null and exists (select 1 from public.teams t where t.id = games.team_id))
      or (team_id is null and owner_id = auth.user_id())
    )
  )
  with check (
    (select public.is_allowed()) and (
      (team_id is not null and exists (select 1 from public.teams t where t.id = games.team_id))
      or (team_id is null and owner_id = auth.user_id())
    )
  );

-- The Data API caches the schema; reload so it sees the new table and column.
notify pgrst, 'reload schema';

-- ============ MANAGING COACHES (normally done in the app) ============
-- Give a coach an age group (they must be on the access list first):
--   insert into public.allowed_emails (email, note) values ('coach@example.com', 'U15 coach')
--     on conflict (email) do nothing;
--   insert into public.coach_age_groups (email, age_group) values ('coach@example.com', 'U15');
-- See who coaches what:
--   select age_group, email from public.coach_age_groups order by age_group, email;
