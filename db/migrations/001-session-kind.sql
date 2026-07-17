-- Adds the "session" entry kind (CLAUDE.md's Sessions feature — a divider
-- line, e.g. "Dev's not here", that sets the default cast for lines beneath
-- it). No new table: the session is just another row in `entries`, so the
-- only schema change is widening the kind check.
--
-- Run this once in the Supabase SQL Editor for a project already set up from
-- db/supabase-setup.sql. Fresh setups don't need this — supabase-setup.sql
-- already includes 'session' in the check.

alter table entries drop constraint entries_kind_check;
alter table entries add constraint entries_kind_check
  check (kind in ('expense','settlement','strike','session'));
