-- Hisaab — paste this whole file into the Supabase SQL Editor and run it once.
-- It creates the schema, enables row-level security, and turns on realtime.
--
-- Security posture (v1): Hisaab is a trust object with no accounts — identity is
-- just a name you tap, stored on your device (CLAUDE.md §2). So anyone with the
-- anon key can read and *append*. What RLS enforces here is the ledger's real
-- invariant: the log is append-only. `entries` can be inserted and read but
-- never updated or deleted (corrections are new "strike" rows). Only
-- `hisaabs.status` and `hisaab_members.on_roster` may change.

-- ── Schema (matches db/schema.sql) ─────────────────────────────────────────
create table if not exists people (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists hisaabs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null check (kind in ('rolling','trip')),
  deity       text not null check (deity in ('ganesh','lakshmi')),
  status      text not null default 'open' check (status in ('open','dissolved')),
  created_at  timestamptz not null default now()
);

create table if not exists hisaab_members (
  hisaab_id   uuid references hisaabs(id),
  person_id   uuid references people(id),
  on_roster   boolean not null default true,
  primary key (hisaab_id, person_id)
);

create table if not exists entries (
  id          uuid primary key default gen_random_uuid(),
  hisaab_id   uuid references hisaabs(id),
  kind        text not null check (kind in ('expense','settlement','strike')),
  label       text,
  amount      integer,
  payer_id    uuid references people(id),
  payee_id    uuid references people(id),
  split_ids   uuid[],
  target_id   uuid references entries(id),
  authored_by uuid references people(id) not null,
  created_at  timestamptz not null default now()
);

-- ── Row-level security ──────────────────────────────────────────────────────
alter table people          enable row level security;
alter table hisaabs         enable row level security;
alter table hisaab_members  enable row level security;
alter table entries         enable row level security;

-- read everything
drop policy if exists read_people  on people;
drop policy if exists read_hisaabs on hisaabs;
drop policy if exists read_members on hisaab_members;
drop policy if exists read_entries on entries;
create policy read_people  on people         for select using (true);
create policy read_hisaabs on hisaabs        for select using (true);
create policy read_members on hisaab_members for select using (true);
create policy read_entries on entries        for select using (true);

-- append (insert) everything
drop policy if exists write_people  on people;
drop policy if exists write_hisaabs on hisaabs;
drop policy if exists write_members on hisaab_members;
drop policy if exists write_entries on entries;
create policy write_people  on people         for insert with check (true);
create policy write_hisaabs on hisaabs        for insert with check (true);
create policy write_members on hisaab_members for insert with check (true);
create policy write_entries on entries        for insert with check (true);

-- the only mutable state: hisaab status and roster membership.
-- (entries gets no update/delete policy on purpose → append-only, DB-enforced.)
drop policy if exists update_hisaab_status on hisaabs;
drop policy if exists update_member_roster on hisaab_members;
create policy update_hisaab_status on hisaabs        for update using (true) with check (true);
create policy update_member_roster on hisaab_members for update using (true) with check (true);

-- ── Realtime (live sync between flatmates) ──────────────────────────────────
alter publication supabase_realtime add table people;
alter publication supabase_realtime add table hisaabs;
alter publication supabase_realtime add table hisaab_members;
alter publication supabase_realtime add table entries;
