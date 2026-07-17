# How it works

Current architecture snapshot. Describes the present, not the plan — see CLAUDE.md for the spec and JOURNAL.md for the why.

## Where things stand

Steps 1–6 are essentially done: engine, the three pages, both flows, corrections, groups, page-turn navigation, scoped identity via join links, Supabase persistence with realtime sync, and view links with a server-rendered OG image. Remaining: PWA/offline (step 7), sessions (step 8).

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
src/lib/guestView.ts  Builds a view link's render: one person, one hisaab. 6 tests.
src/lib/format.ts    Shared inr()/netPhrase() — was duplicated across 3 components.
src/lib/identity.ts  device_id + chosen person_id in localStorage. No accounts.
src/lib/supabase.ts  The browser client (null when env vars are absent).
src/lib/db.ts        Append-only data layer: fetchAll, fetchGuestData, insert*, realtime subscribe.
src/components/WhoAreYou.tsx  The name chooser — always scoped by the caller (a
                     hisaab's roster, or nothing) — never a global directory.
src/components/GuestPage.tsx  The view-link render — a distinct, read-only page.
db/supabase-setup.sql  One-time SQL to run in the project (schema + RLS + realtime).
.env.example         The two NEXT_PUBLIC vars; copy to .env.local (gitignored).
src/lib/seed.ts      Hardcoded seed: two hisaabs (Goa, Ghar), a settlement, an old account.
src/components/Book.tsx  The book: owns all state, scopes it by membership, turns
                     between the three pages, handles the join-link flow.
src/components/PersonPage.tsx  Page 1 — Accounts: masthead (name + overall net),
                     per-person breakdown, settle gesture.
src/components/GroupsPage.tsx  Page 2 — Hisaabs: the group list + the new-hisaab composer.
src/components/HisaabPage.tsx  Page 3 — a ledger: entries, write flow, tap-to-strike,
                     the "invite" (copy join link) button, per-guest view links.
app/layout.tsx       Root layout; loads globals.css.
app/globals.css      Tokens + the paper: font faces, ruled background, rhythm, page-turn.
app/page.tsx         Home → the Book (bootstrap mode: no joinHisaabId).
app/join/[hisaabId]/page.tsx  A hisaab's join link → the Book, scoped to that hisaab.
app/view/[hisaabId]/[personId]/page.tsx  A guest's read-only page. No Book, no nav.
app/view/[hisaabId]/[personId]/layout.tsx  generateMetadata (title/description) —
                     server component, since the page itself is a client component.
app/view/[hisaabId]/[personId]/opengraph-image.tsx  Renders the actual khata page as
                     the share preview image (next/og + a plain-woff Kalam copy).
app/hisaab/[id]/page.tsx  Redirects to home; navigation lives inside the book now.
public/fonts/        Self-hosted Kalam woff2 (Latin + Devanagari, 300/400/700), plus
                     kalam-og.woff — a plain-woff copy for next/og (Satori can't read woff2).
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

- **Payer of a new line = the current person** (the signed-in identity). There
  is no payer picker; see the JOURNAL entry for why, and the open question of
  recording that someone *else* paid (the guest-paid-for-petrol case).
- New lines persist via `onAddEntries` → Supabase (see Persistence below); the
  log is append-only, so a write is just an insert.
- **Tap-to-strike:** each expense line is a `<button>`; tapping it appends a
  `strike` targeting it, tapping a struck line appends a strike targeting the
  live strike (undo). Struck lines stay on the page, greyed. Note: the line
  keeps the Kalam hand because `.entry` (a class) out-specifies the UA `button`
  font — don't add `font: inherit` to the button reset or you lose it.

## The person page (home)

`app/page.tsx` → `PersonPage`, driven by `buildPersonPage` (`personView.ts`).
It opens with a masthead — the signed-in name and one overall net figure
("you owe ₹X" / "you're owed ₹X" / "you're all settled up"), summed across
everyone — then lists every other person with a non-zero net: one signed
number (the direction is words — "you owe" / "owes you"), then the working
beneath — one line per hisaab (gross, linking to that ledger) plus one line
per settlement between the two of you.

- **The masthead is the page's own instance of "show the number, then the
  working"** (§1) — one level up from the per-person rows, which are already
  that rule applied to each person.
- **The working always reconciles to the total** (asserted in tests). Group
  lines carry the gross expense nets; settlement lines carry the rest. Because a
  group page is gross forever but the total nets settlements in, the settlement
  lines are what make the column add up — that's why they're shown, not hidden.
- **Old accounts** = people off *every* roster who are still non-zero (Sameer).
  Greyed, below the active ones. Zero + off-roster disappears silently (§5).
- Sorted by magnitude, biggest balance first. Home uses the ganesh deity line.
- `people`/`hisaabs` are pre-scoped by `Book` to this person's own circle — see
  Identity below.

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

## Persistence (Supabase)

When `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set,
`src/lib/supabase.ts` makes a client and the book runs off the database:

- On mount it `fetchAll()`s the four tables into state and opens a realtime
  channel; children write through actions (`addEntries`/`addPerson`/`addHisaab`)
  that update state optimistically and insert to Supabase. Realtime inserts are
  merged by id (a locally-inserted row echoes back and must not double up).
- **Append-only is enforced in the database.** RLS grants select + insert on
  every table but no update/delete on `entries` — corrections stay strikes, by
  the DB, not just by convention. Only `hisaabs.status` and
  `hisaab_members.on_roster` are updatable. See `db/supabase-setup.sql`.
- **No auth** (§9's "RLS scoped by membership" is relaxed for v1): identity is a
  tapped name, so anyone with the anon key can read/append — it's a trust
  object. The anon/publishable key is safe in the client; RLS is the gate.
- With no project configured, `supabase` is null, every db function no-ops, and
  the app runs on the in-memory seed exactly as before.

## Identity and scope

Identity is **scoped**, not global — there is no screen anywhere that lists
every person who has ever used the app. This was a real bug fixed after launch:
the first cut had one "Who are you?" directory covering every hisaab in the
database, so any device could pick any name and immediately see every group.
The fix, matching CLAUDE.md §6 (join links), is now the whole model:

- **Bootstrap** (`app/page.tsx`, no `joinHisaabId`): a device with no identity
  can only *write its own name* — `WhoAreYou` is passed `people={[]}`, so there
  is no list to browse at all. This alone closes "pick someone else's name from
  a directory." A fresh identity here has zero hisaabs and lands on the Hisaabs
  page to create or be invited into one.
- **Join link** (`app/join/[hisaabId]/page.tsx`): the shared secret that grants
  write access to *one* hisaab (§6). A device with no identity sees only that
  hisaab's own roster (`WhoAreYou` scoped to `members.filter(hisaabId===...)`)
  plus "add new" for a genuine newcomer. A device that's *already* signed in
  skips the chooser entirely — it's silently added to that hisaab's roster (if
  not already on it) and dropped straight into the ledger.
- **`Book` derives `myHisaabs`/`myPeople`** every render from `hisaab_members`:
  the hisaabs this person belongs to, and the union of everyone who shares any
  of those hisaabs (plus themselves). These scoped lists — not the raw
  `hisaabs`/`people` state — are what get passed to `PersonPage`, `GroupsPage`,
  and `HisaabPage`. Opening a `{name:"hisaab", id}` view is also gated: if `id`
  isn't in `myHisaabIds`, it renders nothing. Nobody sees a hisaab, or a
  person, they don't actually share one with.
- **No password, no OTP, no accounts** (§2 stands) — tapping/writing a name is
  still the whole of signing in. What changed is *which* names and *which*
  hisaabs are ever shown to a given device. The join link itself is the secret;
  anyone holding it can still claim any name on that one roster (the accepted
  "steal the physical notebook" risk) — but a stranger with no link sees nothing.
- **No switch control.** Once a device picks a name, that's final in the UI —
  as sticky as a physical notebook. (`clearIdentity()` still exists in
  `identity.ts` for a future deliberate reset flow; nothing calls it today.)
- The masthead symmetry still holds (verified): Avish sees "Ravi owes you
  5,900", Ravi sees "you owe Avish 5,900" — falls out of pairwise netting free.

## The groups page (Hisaabs)

Lists your hisaabs (`myHisaabs`, scoped — see above) with your standing in each
("you're owed X" — the sum of your pairwise nets inside that group, gross of
settlements). Below, the new-hisaab composer: a name line, a rolling/trip
toggle, cast chips over `myPeople` (your existing circle — tap to include), and
an "add a name" line that creates a brand-new Person and adds them to the cast.
Creating assigns the deity by alternation (`hisaabs.length % 2`), makes
everyone in the cast an on-roster member, and turns straight into the new
ledger.

**A new person + an immediate dependent insert is a real race**, fixed twice
over here: `Book.addPerson` is `async` and awaited before any insert that
references that person's id (a `hisaab_members` row, e.g.) — otherwise the
foreign key can reach Postgres before the person row does. `GroupsPage` mirrors
this with a `pendingPeople` ref of in-flight inserts, awaited in `create()`
before the hisaab (and its member rows) go out.

### The settle gesture (Chukta)

`PersonPage` is a client component holding entry state. Tapping a person's net
number (it's a button) opens a settle line pre-filled with the full amount;
edit it for a partial, Enter commits a `settlement` entry in the direction that
moves the balance toward zero (the one who owes pays the one who's owed). The
balance recomputes immediately — no confirm, no approve (§2). A wrong one is
handled by a strike, not an undo button. Like the write flow, settlements live
in client state only until Supabase.

## View links (guest render)

The other half of §6: a join link grants write to one hisaab; a view link is
read-only, forever, scoped to one *person's* page of one hisaab —
`/view/<hisaabId>/<personId>`. It never touches `Book` — no identity check, no
navigation, no write flow. Anyone holding the URL can read it; that's the
accepted trade (forwarding it leaks only that person's page, same as
forwarding a photo — §6).

- **`buildGuestView`** (`src/lib/guestView.ts`) — pure, tested (6 cases). Takes
  the full entry log + one hisaab + one personId and returns their one net
  number for *that hisaab only* (gross — settlements are person-level and
  never shown here, same as a hisaab page never claims to be settled, §3/§12)
  plus one `GuestLine` per expense they're actually in (payer or in
  `splitIds`) — their share, who paid, and the full amount. Matches the
  JOURNAL's render exactly: `Movie 300 / Dev paid 1200 / you owe Dev`.
- **`fetchGuestData(hisaabId, personId)`** (`db.ts`) — a scoped query, not
  `fetchAll`: the hisaab row, its roster's people (via a `hisaab_members` join,
  not the whole `people` table), and that hisaab's entries + every strike
  (strikes carry `hisaab_id: null`, so `liveEntries` needs the full strike set
  to resolve correctly).
- **`page.tsx` is a client component** (fetches on mount, same pattern as
  `Book`); **`layout.tsx` is a server component** that exports
  `generateMetadata` — title/description can't come from a client component,
  so the route is split. A malformed id reaches Postgres as an *error*, not an
  empty result — both `generateMetadata` and the OG image route explicitly
  catch that and fall back, or the whole route 500s instead of showing "link
  not found."
- **`opengraph-image.tsx`** renders the actual khata page as the share preview
  (§6: "every share is a free ad") using `next/og`'s `ImageResponse`. One trap:
  Satori (which powers it) cannot read `.woff2`, only ttf/otf/woff — the app's
  self-hosted Kalam files are all woff2, so there's a second copy,
  `public/fonts/kalam-og.woff` (Latin only; the OG image never renders
  Devanagari), fetched from Google Fonts with a legacy user-agent that serves
  plain woff instead.
- **Sharing:** each hisaab's "Guest links" section (`HisaabPage`) lists the
  roster with a "view link" button per person, copying
  `/view/<hisaabId>/<personId>` to the clipboard — same pattern as "invite"
  (the join link), one tier down.

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
