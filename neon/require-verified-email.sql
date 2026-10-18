-- Hardening: only VERIFIED email addresses count for access, and admins cannot
-- edit their own allowlist entry.
-- Run this in the Neon Console → SQL Editor on an existing project (fresh
-- projects already get these definitions from allowlist.sql and admin.sql).
--
-- Why: is_allowed() and is_admin() match the signed-in account to the allowlist
-- by email. If email/password sign-up is ever enabled without verification,
-- someone could register an invited address (or the admin's) before its real
-- owner and inherit that access. Requiring "emailVerified" closes that gap.
-- Signing in with an emailed code verifies the address, so normal users are
-- unaffected.
--
-- STEP 1 — check before applying. Every account you expect to keep access must
-- show email_verified = true (the column name is "emailVerified", camelCase):
--
--   select email, "emailVerified" from neon_auth."user" order by email;
--
-- If that query errors with "column does not exist", stop: the column is named
-- differently in your Neon Auth version. List the columns with
--   select column_name from information_schema.columns
--   where table_schema = 'neon_auth' and table_name = 'user';
-- and adjust the three references to "emailVerified" below.
--
-- If you lock yourself out, re-run neon/allowlist.sql and neon/admin.sql from
-- git history before this change, or just sign in once with an emailed code
-- (which marks the address verified).

-- STEP 2 — apply.

create or replace function public.current_email()
returns text
language sql
stable
security definer
set search_path = public, neon_auth
as $$
  select u.email
  from neon_auth."user" u
  where (u.id = auth.uid() or u.id::text = auth.user_id())
    and u."emailVerified";
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
      and u."emailVerified"
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
  select coalesce((
    select a.is_admin
    from neon_auth."user" u
    join public.allowed_emails a
      on lower(a.email) = lower(u.email)
    where (u.id = auth.uid() or u.id::text = auth.user_id())
      and u."emailVerified"
      and coalesce(u.banned, false) = false
    limit 1
  ), false);
$$;

-- Admins can edit other entries but not their own: changing their own email or
-- clearing their own admin flag would lock them out, which the delete policy
-- already prevents for deletion.
drop policy if exists allowed_emails_update on public.allowed_emails;
create policy allowed_emails_update on public.allowed_emails for update to authenticated
  using (
    (select public.is_admin())
    and lower(email) <> lower(coalesce((select public.current_email()), ''))
  )
  with check ((select public.is_admin()));

notify pgrst, 'reload schema';
