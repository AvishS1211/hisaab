# Changelog

## Unreleased

### Added
- **The book + page-turn navigation** — home is now a book of pages: Accounts (profile) → Hisaabs (groups) → a ledger. Swipe right-to-left to go deeper, left-to-right to come back, each with a page-turn animation (rotate around the left spine, blank paper on the back). The book owns all state, so writes/strikes/settlements/new groups persist as you move between pages.
- **Groups page + add a hisaab** — lists every hisaab with your standing in it, and a composer to create one: name it, pick rolling/trip, choose the cast (and add brand-new people inline). Deity auto-alternates. Creating a hisaab turns you straight into it.
- **Tap-to-strike** — tap any line on a hisaab to strike it (greyed, lined through, still there); tap a struck line to strike the strike (undo). Corrections are new rows, never deletes. Hovering previews the strike.
- **Settle gesture (Chukta)** — tap a person's net number on the home page, write the payment (pre-filled with the full amount, editable for partials), Enter commits a settlement. The balance moves immediately — no confirm, no approve. Full settlement drops the person off the page; a partial leaves a reconciling "X paid you" line in the working.
- **Person page (home)** — net per person across all hisaabs, the per-group and settlement breakdown underneath (which always reconciles to the total), and an "Old accounts" zone for moved-out people who still owe. Group lines link to their ledger. `personView` has 6 tests. Seed grew a second hisaab (Ghar), a settlement, and a moved-out person.
- **Write flow (Likhna)** — the always-open line at the bottom of a hisaab: type `Petrol 2400`, tap cast chips to leave people off the line, Enter commits. No add button, no amount field, no modal. New lines append to client state (no backend yet). `parseLine` has 6 tests.
- **Balance engine** (`src/lib/balance.ts`) — pure, append-only, recomputed on read. Pairwise netting, integer-rupee splitting with payer-absorbs-remainder, recursive strike resolution. 16 tests.
- **Schema** (`db/schema.sql`) — `people`, `hisaabs`, `hisaab_members`, `entries`. Append-only; no `balance` column.
- **Hisaab page** (read-only) — the ruled-paper ledger at `/hisaab/[id]`, on a strict 28px baseline grid: cream paper, red margin, blue rules, deity as text, Kalam handwriting for ledger content, struck-but-visible lines. Hardcoded seed data.
- Self-hosted Kalam font (woff2, Latin + Devanagari).
