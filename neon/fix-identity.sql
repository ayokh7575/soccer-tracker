-- Fix: identify the signed-in user correctly in the access-control helpers.
-- Run this in the Neon Console → SQL Editor.
--
-- neon_auth."user".id is a uuid. auth.uid() returns uuid directly, whereas
-- auth.user_id() returns text — the original helpers compared
-- u.id = auth.user_id()::uuid, which did not match, so is_allowed() returned
-- false for everyone and locked the owner out of their own app.
--
-- Both identifiers are accepted below so the match does not depend on which
-- one pg_session_jwt populates.

create or replace function public.current_email()
returns text
language sql
stable
security definer
set search_path = public, neon_auth
as $$
  select u.email
  from neon_auth."user" u
  where u.id = auth.uid() or u.id::text = auth.user_id();
$$;

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
    where (u.id = auth.uid() or u.id::text = auth.user_id())
      and coalesce(u.banned, false) = false
  );
$$;

create or replace function public.is_admin()
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
    where (u.id = auth.uid() or u.id::text = auth.user_id())
      and a.is_admin
      and coalesce(u.banned, false) = false
  );
$$;

grant execute on function public.current_email() to authenticated;
grant execute on function public.is_allowed() to authenticated;
grant execute on function public.is_admin() to authenticated;

notify pgrst, 'reload schema';
