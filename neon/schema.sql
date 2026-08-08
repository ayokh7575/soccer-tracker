-- Soccer club platform — database schema (Neon)
-- Run this in the Neon Console → SQL Editor (one time per project).
-- Safe to re-run: tables use "if not exists" and policies are dropped/recreated.
--
-- Ported from the Supabase schema. Differences:
--   * Identity comes from Managed Better Auth via the Data API's JWT.
--     auth.user_id() returns the JWT 'sub' claim as text (auth.uid() would
--     parse it as a UUID — we use text so any Better Auth id format works).
--   * owner_id is text and has no FK to the auth user table, so the app
--     schema stays decoupled from the auth provider's internals.
--
-- Design notes (unchanged from before):
--   * teams + players are the SHARED CORE used by every future platform app.
--   * players is a first-class table (not a JSON blob) so other apps
--     (training attendance, health, dashboard) can reference player_id.
--   * Access is rooted at the TEAM: child tables derive access from the
--     parent team, so adding club-sharing later means editing ONLY the team
--     policy — every other policy keeps working unchanged.

-- ============ SHARED CORE (used by all platform apps) ============

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null default auth.user_id(),
  name text not null,
  default_game_duration int,
  players_per_side int check (players_per_side in (9, 11)),
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  number text not null,
  position text not null,
  secondary_positions text[] not null default '{}',
  is_unavailable boolean not null default false,
  is_borrowed boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============ TRACKER APP (playing time + game history) ============

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null default auth.user_id(),
  team_id uuid references public.teams(id) on delete set null,
  name text not null,
  team_name text not null,
  played_at timestamptz not null default now(),
  team_score int not null default 0,
  opponent_score int not null default 0,
  total_time int not null default 0,
  player_stats jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists idx_teams_owner on public.teams(owner_id);
create index if not exists idx_players_team on public.players(team_id);
create index if not exists idx_games_owner on public.games(owner_id);
create index if not exists idx_games_team on public.games(team_id);

-- ============ ROW-LEVEL SECURITY ============

alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.games enable row level security;

-- TEAMS: per-user today. THIS is the policy to broaden for club-sharing later.
drop policy if exists team_access on public.teams;
create policy team_access on public.teams for all to authenticated
  using (owner_id = auth.user_id())
  with check (owner_id = auth.user_id());

-- PLAYERS: visible iff you can see the parent team.
drop policy if exists player_access on public.players;
create policy player_access on public.players for all to authenticated
  using (exists (select 1 from public.teams t where t.id = players.team_id))
  with check (exists (select 1 from public.teams t where t.id = players.team_id));

-- GAMES: per-user (kept independent of team so imported/orphan games stay visible).
drop policy if exists game_access on public.games;
create policy game_access on public.games for all to authenticated
  using (owner_id = auth.user_id())
  with check (owner_id = auth.user_id());

-- ============ DATA API EXPOSURE ============
-- Grant access to the 'authenticated' role only — never 'anon', so a logged-out
-- client cannot reach these tables at all. RLS then restricts which ROWS each
-- authenticated user can see.
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.teams,
  public.players,
  public.games
  to authenticated;
grant usage, select on all sequences in schema public to authenticated;
