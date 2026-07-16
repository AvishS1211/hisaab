-- Hisaab — append-only ledger schema.
--
-- Nothing in `entries` is ever updated or deleted. The only UPDATE anywhere in
-- the app is on `hisaabs.status`. Every balance is derived from `entries` at
-- read time; there is no `balance` column by design. See CLAUDE.md §3.

create table people (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table hisaabs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null check (kind in ('rolling','trip')),
  deity       text not null check (deity in ('ganesh','lakshmi')),
  status      text not null default 'open' check (status in ('open','dissolved')),
  created_at  timestamptz not null default now()
);

create table hisaab_members (
  hisaab_id   uuid references hisaabs(id),
  person_id   uuid references people(id),
  on_roster   boolean not null default true,
  primary key (hisaab_id, person_id)
);

-- Append-only. Nothing in this table is ever updated or deleted.
create table entries (
  id          uuid primary key default gen_random_uuid(),
  hisaab_id   uuid references hisaabs(id),        -- null for settlements (person-level, pairwise)
  kind        text not null check (kind in ('expense','settlement','strike')),
  label       text,                                -- expense only
  amount      integer,                             -- rupees, expense + settlement
  payer_id    uuid references people(id),          -- expense: who paid. settlement: who sent.
  payee_id    uuid references people(id),          -- settlement only: who received
  split_ids   uuid[],                              -- expense only: who it's split across
  target_id   uuid references entries(id),         -- strike only: the entry being struck
  authored_by uuid references people(id) not null,
  created_at  timestamptz not null default now()
);
