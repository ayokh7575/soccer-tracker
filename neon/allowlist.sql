-- Invite-only access control (replaces Supabase's "disable signups" setting).
-- Run this in the Neon Console → SQL Editor AFTER neon/schema.sql.
--
-- Neon Auth has no built-in signup restriction yet, so anyone can create an
-- account. This makes that harmless: every RLS policy also requires the signed-in
-- user's email to be on the allowlist, so an uninvited account can log in but
-- sees nothing at all — no teams, no players, no games — and cannot write.
-- Enforcement is in the database, so tampering with the client cannot bypass it.
--
-- This is also the seam for the future billing check: when subscriptions arrive,
-- is_allowed() becomes has_access(user, app) and the policies stay as they are.

-- ============ ALLOWLIST TABLE ============

create table if not exists public.allowed_emails (
  email text primary key,
  note text,
  added_at timestamptz not null default now()
);

-- RLS on with NO policies and NO grants: the Data API cannot read or write this
-- table at all. Manage it only from the SQL Editor (the owner bypasses RLS).
alter table public.allowed_emails enable row level security;

-- IMPORTANT: add yourself BEFORE applying the policies below, or you will lock
-- yourself out of your own data (recoverable here in the SQL Editor, but avoid it).
insert into public.allowed_emails (email, note)
values ('ayokh75@gmail.com', 'owner')
on conflict (email) do nothing;

-- ============ ENTITLEMENT CHECK ============

-- SECURITY DEFINER so it can read neon_auth."user" and allowed_emails even though
-- the 'authenticated' role has no grants on them. search_path is pinned so the
-- function body cannot be hijacked by a caller-controlled search_path.
--   * "user" is quoted: it is a reserved SQL keyword.
--   * u.id is uuid, auth.user_id() returns the JWT 'sub' as text — hence the cast.
create or replace function public.is_allowed()
returns boolean
language sql
stable
security definer
set search_path = public, neon_auth
as $$
  select exists (
    select 1
    from neon_auth."user" u
    join public.allowed_emails a
      on lower(a.email) = lower(u.email)
    where u.id = auth.user_id()::uuid
      and coalesce(u.banned, false) = false
  );
$$;

grant execute on function public.is_allowed() to authenticated;

-- ============ POLICIES (recreated with the allowlist check) ============
-- is_allowed() is wrapped in a scalar subquery so Postgres evaluates it once per
-- statement rather than once per row.

drop policy if exists team_access on public.teams;
create policy team_access on public.teams for all to authenticated
  using (owner_id = auth.user_id() and (select public.is_allowed()))
  with check (owner_id = auth.user_id() and (select public.is_allowed()));

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

drop policy if exists game_access on public.games;
create policy game_access on public.games for all to authenticated
  using (owner_id = auth.user_id() and (select public.is_allowed()))
  with check (owner_id = auth.user_id() and (select public.is_allowed()));

-- ============ MANAGING ACCESS ============
-- Invite someone (they can then sign in and get their own private workspace):
--   insert into public.allowed_emails (email, note) values ('coach@example.com', 'U16 coach');
-- Revoke access immediately (their data is retained, just inaccessible):
--   delete from public.allowed_emails where email = 'coach@example.com';
-- See who has access:
--   select * from public.allowed_emails order by added_at;
