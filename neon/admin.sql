-- Admin management of the access list (run AFTER neon/allowlist.sql).
--
-- Lets an admin add/remove/see allowed users from inside the app instead of
-- running SQL in the Neon Console. The allowlist table becomes readable and
-- writable through the Data API, so access is restricted by RLS: only accounts
-- flagged is_admin can see or change it.
--
-- The helper functions are SECURITY DEFINER, so they run as the table owner and
-- bypass RLS. That is what stops the policies on allowed_emails recursing into
-- themselves when they call is_admin().

-- ============ ADMIN FLAG ============

alter table public.allowed_emails
  add column if not exists is_admin boolean not null default false;

-- Make the owner an admin (edit if your address differs).
update public.allowed_emails
set is_admin = true
where lower(email) = lower('ayokh75@gmail.com');

-- ============ HELPERS ============

-- Email of the signed-in account.
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

-- Is the signed-in account an admin?
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
grant execute on function public.is_admin() to authenticated;

-- ============ DATA API ACCESS TO THE ALLOWLIST ============

grant select, insert, update, delete on public.allowed_emails to authenticated;

-- Only admins can see the list.
drop policy if exists allowed_emails_read on public.allowed_emails;
create policy allowed_emails_read on public.allowed_emails for select to authenticated
  using ((select public.is_admin()));

-- Only admins can invite.
drop policy if exists allowed_emails_insert on public.allowed_emails;
create policy allowed_emails_insert on public.allowed_emails for insert to authenticated
  with check ((select public.is_admin()));

-- Only admins can edit an entry (e.g. grant or revoke admin).
drop policy if exists allowed_emails_update on public.allowed_emails;
create policy allowed_emails_update on public.allowed_emails for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Only admins can revoke, and never their own row — that would lock the admin
-- out of the very screen used to fix it.
drop policy if exists allowed_emails_delete on public.allowed_emails;
create policy allowed_emails_delete on public.allowed_emails for delete to authenticated
  using (
    (select public.is_admin())
    and lower(email) <> lower(coalesce((select public.current_email()), ''))
  );

-- The Data API caches the schema; without this it will not expose the new
-- functions or the allowlist table.
notify pgrst, 'reload schema';
