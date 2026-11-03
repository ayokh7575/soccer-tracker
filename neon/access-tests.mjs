// Checks the database access rules (Row-Level Security) against a real
// Postgres engine (PGlite, in-process), with a stand-in for Neon Auth's
// auth.user_id() / neon_auth."user". Run with: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const db = new PGlite();
const run = (f) => db.exec(readFileSync(`${dir}/neon/${f}`, 'utf8'));
await db.exec(`
  create role authenticated nologin; create role anon nologin;
  create schema auth;
  create function auth.user_id() returns text language sql stable as $$ select nullif(current_setting('test.uid', true), '') $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema auth to authenticated;
  grant execute on all functions in schema auth to authenticated;
  create schema neon_auth;
  create table neon_auth."user" (id uuid primary key, email text, "emailVerified" boolean, banned boolean);
`);
for (const f of ['schema.sql','allowlist.sql','admin.sql','require-verified-email.sql','age-groups.sql']) {
  try { await run(f); console.log('ran', f); } catch (e) { console.log('FAIL', f, e.message); process.exit(1); }
}
// users
const U = {
  admin: ['11111111-1111-1111-1111-111111111111','ayokh75@gmail.com'],
  c15a:  ['22222222-2222-2222-2222-222222222222','c15a@x.com'],
  c15b:  ['33333333-3333-3333-3333-333333333333','c15b@x.com'],
  c16:   ['44444444-4444-4444-4444-444444444444','c16@x.com'],
  stranger: ['55555555-5555-5555-5555-555555555555','nobody@x.com'],
  unverified: ['66666666-6666-6666-6666-666666666666','c15c@x.com'],
};
for (const [k,[id,email]] of Object.entries(U)) {
  await db.query(`insert into neon_auth."user" values ($1,$2,$3,false)`, [id,email,k!=='unverified']);
}
const as = async (who, sql, params=[]) => {
  await db.exec('reset role');
  await db.query(`select set_config('test.uid', $1, false)`, [who ? U[who][0] : '']);
  await db.exec('set role authenticated');
  try { const r = await db.query(sql, params); return r; } finally { await db.exec('reset role'); }
};
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const expectErr = async (p, m) => { try { await p; ok(false, m + ' (no error)'); } catch (e) { ok(true, m + ' → ' + e.message.slice(0,60)); } };

// admin adds coaches
await as('admin', `insert into allowed_emails(email) values ('c15a@x.com'),('c15b@x.com'),('c16@x.com'),('c15c@x.com')`);
await as('admin', `insert into coach_age_groups(email, age_group) values ('c15a@x.com','U15'),('c15b@x.com','U15'),('c16@x.com','U16'),('c15c@x.com','U15')`);
await expectErr(as('admin', `insert into coach_age_groups(email, age_group) values ('c16@x.com','u-16')`), 'invalid age group rejected');
await expectErr(as('c15a', `insert into coach_age_groups(email, age_group) values ('c15a@x.com','U16')`), 'coach cannot assign themselves an age group');
ok((await as('c15a', `select * from coach_age_groups`)).rows.length === 1, 'coach sees only own age groups');
ok((await as('admin', `select * from coach_age_groups`)).rows.length === 4, 'admin sees all assignments');

// teams
await as('c15a', `insert into teams(id,name,age_group) values ('aaaaaaaa-0000-0000-0000-000000000001','U15 Blue','U15')`);
await expectErr(as('c15a', `insert into teams(id,name,age_group) values ('aaaaaaaa-0000-0000-0000-000000000002','Sneaky','U16')`), 'coach cannot create team in another age group');
await expectErr(as('c15a', `insert into teams(id,name) values ('aaaaaaaa-0000-0000-0000-000000000003','No group')`), 'team without age group rejected');
await as('c16', `insert into teams(id,name,age_group) values ('bbbbbbbb-0000-0000-0000-000000000001','U16 Red','U16')`);
ok((await as('c15b', `select name from teams`)).rows.map(r=>r.name).join() === 'U15 Blue', 'second U15 coach sees U15 team only');
ok((await as('c16', `select name from teams`)).rows.map(r=>r.name).join() === 'U16 Red', 'U16 coach sees only U16');
ok((await as('admin', `select name from teams order by name`)).rows.length === 2, 'admin sees all teams');
ok((await as('stranger', `select name from teams`)).rows.length === 0, 'non-listed user sees nothing');
ok((await as('unverified', `select name from teams`)).rows.length === 0, 'unverified email sees nothing');
// update / move
await as('c15b', `update teams set name='U15 Blue FC' where id='aaaaaaaa-0000-0000-0000-000000000001'`);
ok((await as('c15a', `select name from teams`)).rows[0].name === 'U15 Blue FC', 'other U15 coach can edit');
await expectErr(as('c15a', `update teams set age_group='U16' where id='aaaaaaaa-0000-0000-0000-000000000001'`), 'coach cannot move team to age group they lack');
const r16 = await as('c16', `update teams set name='hack' where id='aaaaaaaa-0000-0000-0000-000000000001'`);
ok(r16.affectedRows === 0, 'U16 coach cannot edit U15 team');
// players
await as('c15a', `insert into players(team_id,first_name,last_name,number,position) values ('aaaaaaaa-0000-0000-0000-000000000001','A','B','7','CM')`);
ok((await as('c15b', `select * from players`)).rows.length === 1, 'U15 coach sees players');
ok((await as('c16', `select * from players`)).rows.length === 0, 'U16 coach sees no U15 players');
await expectErr(as('c16', `insert into players(team_id,first_name,last_name,number,position) values ('aaaaaaaa-0000-0000-0000-000000000001','X','Y','9','CF')`), 'U16 coach cannot add player to U15 team');
// games
await as('c15a', `insert into games(team_id,name,team_name) values ('aaaaaaaa-0000-0000-0000-000000000001','R1','U15 Blue FC')`);
ok((await as('c15b', `select * from games`)).rows.length === 1, 'U15 coach sees game recorded by colleague');
ok((await as('c16', `select * from games`)).rows.length === 0, 'U16 coach does not see U15 games');
await as('c15a', `insert into games(team_id,name,team_name) values (null,'Imported','X')`);
ok((await as('c15b', `select * from games where team_id is null`)).rows.length === 0, 'teamless game private to recorder (other coach)');
ok((await as('c15a', `select * from games where team_id is null`)).rows.length === 1, 'teamless game visible to recorder');
await expectErr(as('c16', `insert into games(team_id,name,team_name) values ('aaaaaaaa-0000-0000-0000-000000000001','R2','x')`), 'U16 coach cannot save game to U15 team');
// removal of assignment
await as('admin', `delete from coach_age_groups where email='c15b@x.com'`);
ok((await as('c15b', `select * from teams`)).rows.length === 0, 'removing age group removes access');
// delete team by coach
const del = await as('c15a', `delete from teams where id='aaaaaaaa-0000-0000-0000-000000000001'`);
ok(del.affectedRows === 1, 'coach can delete team in their age group');
// removing from access list cascades
await as('admin', `delete from allowed_emails where email='c16@x.com'`);
ok((await as('admin', `select * from coach_age_groups where email='c16@x.com'`)).rows.length === 0, 'removing from access list removes age groups');
// reset
await db.exec(readFileSync(`${dir}/neon/reset-data.sql`, 'utf8'));
ok((await db.query('select count(*)::int n from teams')).rows[0].n === 0, 'reset-data clears teams');
// rerun safe
await run('age-groups.sql'); ok(true, 'age-groups.sql re-runs cleanly');

console.log(process.exitCode ? '\nSome access checks FAILED' : '\nAll access checks passed');
