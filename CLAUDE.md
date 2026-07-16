# Hisaab

A shared expense ledger modelled on the Indian kirana-shop *bahi-khata* — the cloth-bound credit notebook a shopkeeper keeps, with Ganpati or Lakshmi inked at the top of every page.

This document is the source of truth. If a decision here conflicts with how Splitwise does it, this document wins. Splitwise being the reference implementation is why the product exists.

---

## 1. Read this first: the mental model

Three ideas. Everything else is derived from them. If you find yourself writing code that violates one, stop and ask.

**1. The shopkeeper holds the pen. The customer only reads.**
People who write install the PWA. People who only need to see what they owe get a link. The link never writes. This is not a permissions compromise — it is how the object works. The shopkeeper turns the book around and shows you your page; he doesn't hand you the pen.

**2. Ink is not erasable. You can only write more.**
Nothing is ever mutated or deleted. Correcting a line means striking it, which is itself a new line. Settling means writing a settlement line. The log is append-only and every balance in the app is derived from it at read time. There is no `balance` column anywhere. There is no `UPDATE` on any row except `hisaabs.status`.

**3. Show the number, then show the working.**
Never make the user do accounting. Lead with one number. Put the breakdown underneath for anyone who wants to check it. This applies identically on the person page (total, then per-group) and the guest link (what you owe, then the expense and what was actually paid). Same rule, two places.

---

## 2. Non-negotiables

These are the anti-Splitwise rules. Each one deletes a feature you might otherwise be tempted to build.

- **No debt simplification.** Never generate a payment between two people who did not transact. Net *pairwise only*. If A owes B ₹340, that is what the app says. It never says "pay Priya instead because it's fewer transfers." More payments, every one explicable in a sentence. This is the single biggest reason users find Splitwise confusing.
- **No custom-split screen.** Unequal splits are recorded as two lines. Ravi's ₹800 steak and everyone's ₹600 of dosas are two entries, not one entry with per-person weights. Partial payments likewise (A paid ₹2,000, B paid ₹400 → two lines). This is the door three-flows walks through. Keep it shut.
- **No paise.** All amounts are integer rupees. ₹100 across 3 people is 34/33/33 and the extra rupee goes to whoever paid. Never render a decimal anywhere in the UI.
- **No confirm/approve handshake on settlements.** A writes "paid Ravi ₹340." The balance moves immediately. Ravi can strike it if it's wrong. No pending state, no approval request, no notification ping-pong.
- **No signup.** No email, no password, no OTP. Open link → "Who are you?" → tap your name → stored locally. Someone could tap the wrong name and lie. They could also steal the physical notebook. It is a trust object.
- **No add button.** No FAB, no modal, no plus icon. The next ruled line on the page is always open with the cursor in it. You type on the page because the page is a page.
- **No delete-person.** Ever. See §5.

---

## 3. Data model

Postgres via Supabase. Append-only. Amounts are `integer` rupees.

```sql
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
  hisaab_id   uuid references hisaabs(id),        -- null for settlements
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
```

**`hisaab_id` is null on settlements. This is deliberate and load-bearing.**
Settlements are pairwise and person-level. They do not belong to a group. A group page shows the expenses that group generated — gross, forever. The person page shows the net across everything, minus settlements. A *page* is never "settled"; the running total is. This is why there is no settlement-allocation algorithm, and there must never be one.

**Strikes.** A strike is an entry pointing at another entry. Balance computation ignores any entry that has an unstruck strike pointing at it. A strike can itself be struck (undo). Nothing is removed from the table.

### Balance computation

Pure function, no cache, recompute on read.

1. Load all entries. Drop any entry with a live strike against it.
2. For each expense: split `amount` across `split_ids` as integer rupees; remainder goes to `payer_id`. Each split member owes the payer their share.
3. For each settlement: `payer_id` owed `payee_id` `amount` less.
4. Net **pairwise** per (person, person). Never across pairs.

Group-level balance = steps 1–2 filtered to that `hisaab_id`. Person-level = everything.

### Splitting, exactly

```
share  = amount / n           (integer division)
extra  = amount % n
```
Each of the `n` gets `share`. The payer additionally absorbs `extra`. Deterministic, no floats, never a decimal on screen.

---

## 4. The two flows

There are exactly two. If a proposed feature isn't one of these, it's a view — or it isn't in the app.

**Likhna (write).** Type on the open line at the bottom of a hisaab. `Petrol 2400` — last number is the amount, the rest is the label. No amount field. No description field. Cast strip below inherits from the session; tap a name to strike it out of this line. Enter commits.

**Chukta (settle).** Person page shows one net number per person. Tap it, write the payment. Balance moves. Done.

### Sessions

A session is a divider entry on the page that sets a default cast for lines beneath it. "9pm — Dev's not here" — every line after it excludes Dev until the session ends. This is the whole answer to the alcohol problem: one gesture instead of un-checking Dev eight times. Implement as a lightweight cast default in client state, materialised onto each entry's `split_ids` at write time. Do not create a session table — the entries carry the truth.

---

## 5. Roster vs khaata

Two different lists. Do not merge them.

- **Roster** — who gets defaulted into new lines. `hisaab_members.on_roster`. Leaving the roster is always allowed, no conditions. Dev moves out, he's off.
- **Khaata** — who has a non-zero balance. Derived, not stored. Dev stays here until it's zero. **Cannot be removed by anyone, under any condition.**

There is no delete-person. There is only "he doesn't shop here anymore." The number outlives the roster.

On the person page, people who are off-roster but non-zero render in a separate zone below the active ones, greyed, headed "Old accounts." Zero + off-roster = disappears silently. That's the only exit.

---

## 6. Links and identity

Two link types, on different axes. Don't conflate them.

- **Join link** — one per hisaab. Grants write. Opening it prompts PWA install, then "Who are you?" → tap a name → `device_id` in localStorage maps to `person_id`. This is how the four flatmates get in.
- **View link** — one per *person* per hisaab. Read-only, forever. Renders only that person's page: the lines they're in, what was actually paid in total, and what they owe. It cannot render the whole group, so forwarding it leaks only that person's page — same as forwarding a photo of it. Acceptable.

The view link is what you WhatsApp to Rohan, who came to Goa, paid for petrol, and will never install anything. Someone in the cast writes his line for him. He reads his number and pays. He never touches the pen.

**og:image on the view link renders the actual khata page** — paper, deity, ruled lines, the number. Server-rendered OG image. Every share is a free ad. Build this in week one, not later.

---

## 7. Screens

1. **Person page (home)** — Net per person across everything, one line each. Below each: per-group breakdown. Below that: "Old accounts."
2. **Hisaab page** — The ledger. Ruled paper, deity at the top, cast strip, entries chronological, open line at the bottom.
3. **New hisaab** — Name, kind (rolling / trip), cast. Deity is assigned here, alternating, and is sticky forever after.
4. **Guest view** — Read-only, per-person. Not a stripped hisaab page; a distinct render.

That's it. Settings is not a screen worth building yet.

---

## 8. Aesthetic

The vibe *is* the product. If this ships looking like a normal fintech app with a paper texture on it, we failed. That's the failure mode and it's the common one.

- **Paper.** Cream `#F7F1E3`. Blue rule lines at a fixed 28px rhythm — every element must sit on the rhythm, no exceptions, no arbitrary padding breaking the grid. Red vertical margin at 34px from the left. Get the rhythm right and it reads as paper; get it wrong and it reads as a background image.
- **The deity is text, not an icon.** `॥ श्री गणेशाय नमः ॥` or `॥ श्री लक्ष्म्यै नमः ॥` at the top of every page. This is literally what's written in a bahi-khata. It scales, it can't be mistaken for a logo, and it's more authentic than an illustration. Illustrated Ganpati/Lakshmi may appear on the new-hisaab screen only — the moment of opening a page. Never in the chrome, never as the app icon.
- **Handwriting.** Kalam (Google Fonts, self-host the woff2). Ledger content only. Chrome, metadata, and hints are system sans.
- **Struck, never gone.** Settled and corrected lines stay on the page, greyed, with a line through them. This is the trust mechanic and it costs nothing.
- **Copy is English.** Not Hinglish. The app is called Hisaab and the copy is English — which is exactly how the people using it already talk. Sentence case, no exclamation marks, no "successfully."

---

## 9. Stack

- **Next.js 15**, App Router, TypeScript
- **Supabase** — Postgres, Realtime for live sync between flatmates. RLS scoped by hisaab membership.
- **Vercel** — hosting, and `@vercel/og` for the view-link OG images
- **PWA** — manifest + service worker. `next-pwa` or hand-rolled; hand-rolled is fine and smaller.
- **Offline** — IndexedDB queue (Dexie), flush on reconnect. This is trivial *because* the log is append-only: writes are inserts, never merges. There is no conflict resolution and there must not be. See §10 on duplicates.
- **No auth library.** `device_id` in localStorage. That's it.

---

## 10. Edge cases, already decided

Don't re-litigate these. They were argued out.

- **Offline duplicates.** Two people write `Petrol 2400` on the drive home, both sync, both appear. **Do not dedup.** Someone strikes one. Silent dedup is invisible magic, and invisible magic is what makes people distrust a ledger. The strike mechanic already handles it.
- **Reopening a dissolved trip.** Allowed. Flip `status` back to `open`. Because balances are derived, nothing needs to migrate or recompute. This is why append-only was worth it.
- **Guest joins mid-trip.** Add them to `people` and to the trip's roster. They join at zero and stay in `people` forever. Real khatas have names that have owed since 2019. Feature, not bug.
- **Someone moves out owing money.** §5. Off roster, stays in Old accounts until zero.
- **Groups are independent for recording, netted for paying.** A group page never claims to be "settled." The person page nets. §3.

---

## 11. Build order

1. Schema + balance function. Write tests for the balance function first — it is the whole app and it's pure, so it's cheap to test properly. Test: uneven split remainders, pairwise netting across two groups, strikes, struck strikes, dissolved-then-reopened.
2. Hisaab page, read-only, hardcoded seed data. Get the 28px paper rhythm right before anything else. If the paper doesn't feel right at this step, nothing later saves it.
3. The open line + write flow.
4. Person page with breakdown.
5. Join link + identity.
6. View link + OG image.
7. PWA + offline queue.
8. Sessions.

Sessions are last on purpose. They're the best idea in the app but they're an optimisation on a flow that has to work first.

---

## 12. Flagged — my call, not Avish's

One decision was made while writing this spec rather than in conversation. Flagging it so it's easy to reverse.

**Settlements are person-level (`hisaab_id` is null), not allocated to groups.** The alternative was allocating each payment across groups oldest-first, so group pages could zero out. That was rejected: it makes one payment generate several settlement lines, some representing money that never moved — which violates the no-invisible-magic rule established by the duplicates decision. Cost of the current approach: a group page shows gross forever and never reads as "settled." Judged acceptable, because a *page* of a notebook is never settled either — only the running total is.

If Avish wants group pages to zero out, this is the thing to change, and it's contained: `entries.hisaab_id` becomes non-null for settlements, and a `allocateSettlement()` function fans one payment out across groups oldest-first. Nothing else in the spec moves.

---

## 13. Later, not now

- **Diwali muhurat.** A rolling hisaab isn't meant to run forever. At Diwali it closes, everyone settles, a fresh page opens with a new deity at the top. That's the actual ritual, it's a free once-a-year re-engagement hook, and it costs one date check. Not v1, but design nothing that makes it hard.

---

## 14. Project memory

This project keeps three files at the root, per the project-memory convention:

- `HOWITWORKS.md` — current architecture snapshot. **Create it once the schema and balance function are real** (step 1 above), not before. It describes the present; right now there is no present.
- `CHANGELOG.md` — create at first commit that ships something observable.
- `JOURNAL.md` — already seeded. Read it before you start. It has the *why* behind the decisions in this doc, and the why is what stops you from cheerfully rebuilding Splitwise.

Update them as part of finishing work, not as polish afterwards.
