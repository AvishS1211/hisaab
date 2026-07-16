# How it works

Current architecture snapshot. Describes the present, not the plan — see CLAUDE.md for the spec and JOURNAL.md for the why.

## Where things stand

Steps 1–4 of the build order are done plus the settle/strike gestures, group creation, and page-turn navigation. Home is a "book" that turns between the profile, the groups list, and a ledger. No Supabase and no identity yet — nothing survives a reload, and the current person is hardcoded to "You".

## Layout

```
db/schema.sql        The append-only Postgres schema (people, hisaabs,
                     hisaab_members, entries). Source of truth for the DB.
src/lib/types.ts     Domain types mirroring the schema. Amounts are integer rupees.
src/lib/balance.ts   The balance engine — pure, no cache, recomputed on read.
src/lib/balance.test.ts  16 tests covering every rule the engine implements.
src/lib/deity.ts     Deity → the Devanagari line inked at the top of the page.
src/lib/parseLine.ts Likhna parsing: "Petrol 2400" → { label, amount }. 6 tests.
src/lib/personView.ts  Builds the person page from the log: net + reconciling working. 6 tests.
src/lib/seed.ts      Hardcoded seed: two hisaabs (Goa, Ghar), a settlement, an old account.
src/components/Book.tsx  The book: owns all state, turns between the three pages.
src/components/PersonPage.tsx  Page 1 — Accounts: nets, working, settle gesture.
src/components/GroupsPage.tsx  Page 2 — Hisaabs: the group list + the new-hisaab composer.
src/components/HisaabPage.tsx  Page 3 — a ledger: entries, write flow, tap-to-strike.
app/layout.tsx       Root layout; loads globals.css.
app/globals.css      Tokens + the paper: font faces, ruled background, rhythm, page-turn.
app/page.tsx         Home → the Book.
app/hisaab/[id]/page.tsx  Redirects to home; navigation lives inside the book now.
public/fonts/        Self-hosted Kalam woff2 (Latin + Devanagari, 300/400/700).
```

## The paper (the hisaab page)

`app/globals.css` is where the aesthetic lives, and it's load-bearing: get the
28px rhythm wrong and it reads as "a website with a paper texture." Rules:

- **One rhythm: `--line: 28px`.** Every block is a whole number of lines, so
  writing always lands on a rule. Verified: every row's bottom is ≡ 0 (mod 28).
- The ruled lines and the red margin (`--margin-x: 34px`) are the sheet's
  `background-image` (two gradients), not elements — so they never break the grid.
- **Kalam** is used for ledger content only (deity, labels, amounts). Chrome and
  metadata (title, cast chips, payer initials) are system sans.
- Struck entries stay on the page: greyed via `--ink-faded`, line-through in the
  margin-red ink. Nothing is removed.
- Amounts are integer rupees, Indian-grouped (`toLocaleString("en-IN")`). No decimals.

Only expenses render on a hisaab page — settlements are person-level (§3).

## The write flow (Likhna)

`HisaabPage.tsx` is a client component. There is no add button: the last line is
an always-focused `<input>` styled to write on the rule. You type `Petrol 2400`
(`parseLine` takes the trailing whole number as the amount, the rest as the
label — integer rupees only), tap cast chips to leave people off *this* line,
and Enter commits. On commit the draft appends to entry state, the input clears,
the cursor stays, and the cast resets to the full roster for the next line.

- **Payer of a new line = the current person** (hardcoded "You" for now). There
  is no payer picker; see the JOURNAL entry for why, and the open question of
  recording that someone *else* paid (the guest-paid-for-petrol case).
- New lines live in React state only. No persistence yet — Supabase is a later
  step, and because the log is append-only, a write is just an insert.
- **Tap-to-strike:** each expense line is a `<button>`; tapping it appends a
  `strike` targeting it, tapping a struck line appends a strike targeting the
  live strike (undo). Struck lines stay on the page, greyed. Note: the line
  keeps the Kalam hand because `.entry` (a class) out-specifies the UA `button`
  font — don't add `font: inherit` to the button reset or you lose it.

## The person page (home)

`app/page.tsx` → `PersonPage`, driven by `buildPersonPage` (`personView.ts`).
For the current person it lists every other person with a non-zero net: one
signed number (the direction is words — "you owe" / "owes you"), then the
working beneath — one line per hisaab (gross, linking to that ledger) plus one
line per settlement between the two of you.

- **The working always reconciles to the total** (asserted in tests). Group
  lines carry the gross expense nets; settlement lines carry the rest. Because a
  group page is gross forever but the total nets settlements in, the settlement
  lines are what make the column add up — that's why they're shown, not hidden.
- **Old accounts** = people off *every* roster who are still non-zero (Sameer).
  Greyed, below the active ones. Zero + off-roster disappears silently (§5).
- Sorted by magnitude, biggest balance first. Home uses the ganesh deity line.

## The book (navigation)

`Book.tsx` owns the whole client state — `entries`, `people`, `hisaabs`,
`members` — and renders one of three pages: `profile` (Accounts) ⇄ `groups`
(Hisaabs) → `hisaab` (a ledger). Swipe right-to-left goes deeper, left-to-right
comes back; pointer up/down with a ≥70px mostly-horizontal delta counts as a
swipe. Tapping a group name (on either the profile breakdown or the groups
list) also turns forward into that ledger.

The page-turn: while animating, the outgoing/incoming page goes absolute inside
the book, gets `transform-origin: left center` and rotates ±179° around the
spine under `perspective: 2000px`. The reverse face is blank paper
(`backface-visibility: hidden` + a rotated `.face.back`), and a spine-side
gradient gives depth. Forward turns rotate the old page away; back turns rotate
the new page in — that asymmetry is what makes both directions read as turning
a real page. `prefers-reduced-motion` collapses it to ~instant. When idle the
page is in normal flow so long ledgers scroll.

Because the book holds the log, writes, strikes, settlements, and new groups
persist across page turns (still client-state only until Supabase).

## The groups page (Hisaabs)

Lists every hisaab with your standing in it ("you're owed X" — the sum of your
pairwise nets inside that group, gross of settlements). Below, the new-hisaab
composer: a name line, a rolling/trip toggle, cast chips over everyone in
`people` (tap to include), and an "add a name" line that creates a new Person
and adds them to the cast. Creating assigns the deity by alternation
(`hisaabs.length % 2`), makes everyone in the cast an on-roster member, and
turns straight into the new ledger.

### The settle gesture (Chukta)

`PersonPage` is a client component holding entry state. Tapping a person's net
number (it's a button) opens a settle line pre-filled with the full amount;
edit it for a partial, Enter commits a `settlement` entry in the direction that
moves the balance toward zero (the one who owes pays the one who's owed). The
balance recomputes immediately — no confirm, no approve (§2). A wrong one is
handled by a strike, not an undo button. Like the write flow, settlements live
in client state only until Supabase.

## Import convention

Relative imports are extensionless (e.g. `../lib/balance`), which both Vitest
and Next/webpack resolve. Do not add `.js` specifiers — Next's webpack won't
resolve them to `.ts`/`.tsx` sources.

## The balance engine

`src/lib/balance.ts` is the whole app; everything later is a view onto what it returns. It is a pure function of the entry log — there is no stored balance anywhere.

- **`liveEntryIds` / `liveEntries`** — an entry is live unless a *live* strike points at it. Liveness is recursive (a strike can be struck to undo it) and memoised over the target DAG. Struck rows are dropped from balances but still returned for rendering (struck, never gone).
- **`personBalances(entries)`** — all live expenses (any hisaab) + all live settlements, netted **pairwise**. What the person page shows.
- **`groupBalances(entries, hisaabId)`** — only that hisaab's live expenses, netted pairwise. Settlements are person-level and never allocated to a group, so a group page is gross forever.
- **`netBetween(pairs, a, b)`** — signed helper: what `a` owes `b` (negative if reversed).

### Rules it enforces (from CLAUDE.md §2–3)

- **Integer rupees only.** `share = floor(amount / n)`; the remainder is absorbed by the payer, never recorded as a debt. No decimals reach any caller.
- **Pairwise netting only.** Balances are keyed by a canonical person pair; the engine cannot invent a transfer between people who did not transact (no debt simplification).
- **Unequal splits are two entries**, not one weighted entry. The engine has no per-person weights.
- **Settlements move the balance immediately** and carry `hisaabId = null`.
- **No dedup.** Duplicate inserts both count; a strike resolves them.
- **Status-agnostic.** The engine reads only `entries`, so dissolving/reopening a trip migrates nothing and recomputes for free.

## Running the tests

```
npm install
npm run dev       # Next dev server → http://localhost:3000 (redirects to /hisaab/goa)
npm test          # vitest run
npx tsc --noEmit  # typecheck
```
