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
| `npm run build` | Type-check and build to `dist/` |
| `npm run deploy` | Run the tests, bump the patch version, build and publish to GitHub Pages |

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

`neon/require-verified-email.sql` is a one-off update for projects set up
before access checks required a verified email address. New projects get
those definitions from steps 2 and 3 and don't need it.

### How access works

- Anyone can create a Neon Auth account, but they only see data if their
  **verified** email is in `allowed_emails`. Everyone else gets an
  "Access not enabled" screen.
- Each coach only sees their own teams and games (`owner_id`).
- Admins (`allowed_emails.is_admin = true`) can add and remove people in the
  app. They can't remove or edit their own entry.

## Project layout

```
src/
  App.tsx              Main screens: teams, squad, formation, live game wiring
  GameLive.tsx         Live game screen
  views/               History and season stats screens
  hooks/               Data (useTeamStorage, useGameHistory, useAllowedEmails)
                       and game logic (useGameTimer, useGameActions, useDragAndDrop)
  liveGameStorage.ts   Keeps the game in progress on the device so it can be resumed
  historyCsv.ts        Game history CSV import/export
  teamCsv.ts           Squad CSV import
  migrateLocalData.ts  One-time import of data from the old, device-only version
  AuthGate.tsx         Sign-in and the allowlist check
  AdminUsers.tsx       Manage access screen
neon/                  SQL to set up the database
public/USER_MANUAL.md  In-app user manual
```

## CI

`.github/workflows/ci.yml` type-checks, runs the tests and builds on every push
to `main` and on pull requests.
