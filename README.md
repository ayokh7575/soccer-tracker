# Soccer Time Tracker

A web app for coaches to track each player's minutes, goals and cards during a
match, manage squads and formations, and keep a season history. Built for
Northcote City FC; the club name and logo are set in `src/accessConfig.ts`.

Live: https://ayokh7575.github.io/soccer-tracker

## Stack

- React 19 + TypeScript, built with Vite, styled with Tailwind
- [Neon](https://neon.tech) Postgres for data, Neon Auth for sign-in (emailed 6-digit code)
- Data is read and written from the browser through the Neon Data API;
  Row-Level Security in Postgres decides what each user can see
- Hosted on GitHub Pages

## Local development

```sh
npm install
cp .env.example .env.local   # then fill in your Neon Auth URL and Data API URL
npm run dev                  # http://localhost:3000
```

Both values in `.env.local` are public client config (they ship to the
browser). They are not secrets: access is enforced by the database.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm test` | Run the test suite once (`npm run test:watch` to keep watching) |
| `npm run test:db` | Check the database access rules (age groups, admin, unverified accounts) against an in-process Postgres |
| `npm run build` | Type-check and build to `dist/` |
| `npm run deploy` | Run the tests, bump the patch version, build and publish to GitHub Pages |
| `npm run deploy:test` | Publish the current code to `/soccer-tracker/test/` for trying on a phone, without touching the live app (the footer shows `-test` and the build time). The next `npm run deploy` removes it. |

## Database setup (Neon)

Run these files in the Neon Console → SQL Editor, in this order. Each one is
safe to re-run.

1. `neon/schema.sql` — tables (`teams`, `players`, `games`), indexes, Row-Level
   Security and grants.
2. `neon/allowlist.sql` — invite-only access. Adds the `allowed_emails` table
   and the `is_allowed()` check that every policy uses. **Edit the owner email
   in this file before running it**, or you will lock yourself out.
3. `neon/admin.sql` — lets admins manage the access list from inside the app
   (the "Manage access" link in the footer).
4. `neon/age-groups.sql` — age groups: the `coach_age_groups` table,
   `teams.age_group`, and the access rules that share teams within an age group.

`neon/reset-data.sql` deletes **all** teams, players and games (the access list
and age groups are kept). It was used once to start fresh when age groups were
introduced; only run it if you really want an empty slate.

`neon/require-verified-email.sql` is a one-off update for projects set up
before access checks required a verified email address. New projects get
those definitions from steps 2 and 3 and don't need it.

### How access works

- Anyone can create a Neon Auth account, but they only see data if their
  **verified** email is in `allowed_emails`. Everyone else gets an
  "Access not enabled" screen.
- The admin gives each coach one or more **age groups** (U6–U18, Seniors) in
  Manage access. A coach can create, edit and delete teams only in their age
  groups, and every coach in an age group shares all of its teams, players,
  games and stats. Coaches can't see other age groups.
- The admin (`allowed_emails.is_admin = true`) sees and can manage every team,
  adds and removes people and their age groups, and can't remove or edit their
  own entry.
- Games follow their team. A game without a team (e.g. its team was deleted)
  stays visible only to whoever recorded it.
- The list of age groups lives in two places that must match:
  `is_valid_age_group()` in `neon/age-groups.sql` and `AGE_GROUPS` in
  `src/constants.ts`.

`npm run test:db` checks these rules against a real Postgres engine (PGlite)
with test coaches in different age groups — run it after changing any SQL.

## Known limitation: iPhone home-screen app

Sign-in uses a cookie set by Neon Auth on its own domain. iOS home-screen web
apps ("Open as Web App") don't send that cookie back to a page on github.io, so
the code is accepted but the app never sees the session. Neon Auth doesn't
accept the session token any other way (no bearer support), so:

- Use the app in a Safari or Chrome tab, or add it to the home screen with
  **"Open as Web App" turned off** (the manifest also prefers browser mode).
- If someone signs in from a home-screen app anyway, the app explains this
  instead of failing with "Invalid OTP".

The fix, if a full-screen app is wanted, is to serve the app and Neon Auth from
the same site — e.g. host on Cloudflare Pages with a small proxy for
`/api/auth/*` — so the cookie is first-party.

## Project layout

```
src/
  App.tsx              Main screens: teams, squad, formation, live game wiring
  GameLive.tsx         Live game screen
  EndGameDialog.tsx    Save / discard / keep playing when Stop is tapped
  views/               History and season stats screens
  hooks/               Data (useTeamStorage, useGameHistory, useAllowedEmails, useMyAgeGroups)
                       and game logic (useGameTimer, useGameActions, useDragAndDrop)
  liveGameStorage.ts   Keeps the game in progress on the device so it can be resumed
  historyCsv.ts        Game history CSV import/export
  teamCsv.ts           Squad CSV import
  AuthGate.tsx         Sign-in and the allowlist check
  AdminUsers.tsx       Manage access screen
neon/                  SQL to set up the database
public/USER_MANUAL.md  In-app user manual
```

## CI

`.github/workflows/ci.yml` type-checks, runs the tests and builds on every push
to `main` and on pull requests.
