# Journal

A running log of what this project is, the problems we hit, how we solved them, and what we learned.

---

## 2026-07-15 — What is this project

We're building Hisaab because Splitwise makes people do accounting.

The complaint that started it was specific: friends in a shared flat couldn't work out how to settle or what they were on the hook for. Not because the math was hard — because the app makes the ledger the interface. Balances, "simplify debts", groups inside groups, per-person weights on a single expense. It's a double-entry system wearing a social app's clothes, and the cognitive rent gets charged on every single entry.

The reference object is the *bahi-khata* — the red cloth-bound credit notebook a kirana shopkeeper keeps. You buy on udhaar, he writes a line, and when you ask what you owe he says one number. He doesn't itemise. He doesn't show you the atta on the 3rd and the tel on the 9th. He carries the ledger; you only ever see the debt.

That's the product thesis and it's the same thing as the aesthetic. Not "make Splitwise look Indian" — the khata's whole design is *hide the ledger, show the number*, which is precisely the fix Splitwise needs. The look and the UX are one idea. That happened four separate times while we specced this (see the entries below), and by the fourth we stopped treating it as a coincidence.

**Lesson:** the aesthetic is not a skin on this product. If someone puts paper texture over a normal fintech UI, the project is dead and the corpse will look fine.

---

## 2026-07-15 — Groups are independent; settlements are not

**Context:** Late reversal. The working assumption had been that a trip hisaab, on dissolving, folds its numbers into the rolling home hisaab — one balance per person, ever, one payment. That model was clean and it was wrong for this app.

**Decision:** Avish called it: all groups stay independent. The person page shows a total per person; group-wise breakdown sits underneath. Same shape as what a guest sees on a view link — the number, then the working. Consistency across two unrelated screens is a decent sign the principle is real and not a rationalisation.

**Problem this created:** if groups are independent and you net the total to pay, where does the payment land? Ravi owes you ₹200 in Ghar, you owe Ravi ₹340 from Goa, net ₹140 changes hands. Neither group page is now zero, and a trip is supposed to dissolve once it's cleared. Goa can never dissolve.

**First answer, rejected:** allocate payments across groups oldest-first, like a shopkeeper knocking the oldest entries off the top when you hand him ₹500. Authentic, and it lets groups zero out. But it means one payment generates several settlement lines, some of which show money that never actually moved. That's invisible magic — the exact thing we'd banned an hour earlier when deciding not to dedup offline duplicates. Consistency check failed, so the answer failed.

**Resolution:** settlements are pairwise and person-level. `entries.hisaab_id` is null on them. A group page shows the expenses that group generated, gross, forever. The person page nets. Dissolving a trip closes the page to new lines and does nothing else — it doesn't require zero and it migrates nothing.

**Lesson:** a *page* of a notebook is never "settled." Entries get struck; the running total goes to zero. We'd been trying to give a page a lifecycle property that belongs to a balance. Once we stopped, the allocation algorithm evaporated and so did a whole class of bugs.

---

## 2026-07-15 — Three answers that turned out to be one architecture

**Context:** Three edge cases got answered in one message and they looked unrelated. Reopening a dissolved trip: allowed. Offline duplicates: let both appear, someone strikes one. Corrections: strike, don't delete.

**Observation:** there's exactly one shape that satisfies all three. Append-only log, balances always derived, never stored. A strike is a new row. A settlement is a new row. Dissolving is a flag. Reopening flips the flag and everything recomputes for free because nothing was ever baked.

**Resolution:** no `balance` column anywhere in the schema. No `UPDATE` on any row except `hisaabs.status`. Offline sync needs no conflict resolution at all — writes are inserts, and duplicate inserts are a feature we already decided we wanted.

**Lesson:** the edge cases weren't edge cases, they were the data model asking to be noticed. Also: this is just what a khata is. You cannot un-write ink; you can only write more. Fourth time the metaphor and the engineering landed in the same place.

---

## 2026-07-15 — Read-only links, and why that's the shopkeeper

**Context:** The platform question. Rule 3 of the house rules says iOS or macOS only, and this idea fails it — it's a web app and web is load-bearing, not a shortcut. Avish's argument: an old friend joining the group shouldn't have to install anything to see what he owes. Send a link.

Rules got overridden. Correctly, in this case: the link *is* the khata. The shopkeeper never asked anyone to install anything — he turned the book around and showed you the page. An app that demands onboarding before the other person can see their number has broken the metaphor at the root. Aesthetic and distribution turned out to be the same mechanic (third time).

**Then it got better.** Avish scoped the link to read-only: to write, you install the PWA. That accidentally reproduced the khata's actual asymmetry — *the shopkeeper holds the pen, the customer only reads*. Rohan came to Goa, paid for petrol, will never install anything. Someone in the cast writes his line for him. He reads his number and pays. He never touches the pen and never needed to.

**Honest caveat, recorded so we don't lie to ourselves later:** the no-install advantage only covers readers. Anyone who writes installs. The four flatmates all install anyway. The link is for guests and for settle-time. That's still most of the value, but it is not "no install friction."

**What we gave up:** haptics on the strike-out gesture, the iOS share sheet, first-class notifications. Skeuomorphism is also hardest on web — it reads as "website with a paper texture" roughly nine times in ten. That's the bar and it's the entire product.

**Lesson:** the rule was wrong here, but it was wrong for a *reason we could name*. A gate you override on vibes is decoration; a gate you override with an argument is doing its job.

---

## 2026-07-15 — The guest render is better than a balance

**Context:** Scoping the read-only link raised a privacy question nobody had seen: does Rohan see the whole Goa page, including the ₹3,600 of daru he wasn't part of? The shopkeeper shows you *your* page, not the neighbours'.

**Resolution:** Avish's render settled it — show Rohan the expense, the full amount paid, the payer, and his share. Not just "you owe Dev ₹300."

```
Movie                    300
Dev paid 1200            you owe Dev
```

**Why it's right:** the guest can check the arithmetic himself. He isn't being *told* a number, he's being *shown the working*. That's the difference between a khata and a bill, and it's the same show-the-number-then-the-working rule the person page uses.

**Bonus:** it killed the two-link-types problem. It isn't group-link vs guest-link — it's one rendering rule applied per person. Each view link is personal. You can't blast one to the group chat, and forwarding leaks only that person's page, same as forwarding a photo of the page.

**Lesson:** the privacy constraint made the feature better rather than worse. Worth noticing when that happens.

---

## 2026-07-15 — Unequal splits are two lines

**Context:** Ravi ate the ₹800 steak, everyone else had ₹200 dosas. This is the case that makes every splitting app grow an itemiser with per-person amount fields.

**Decision:** two entries. *Steak 800, Ravi.* *Dosa 600, the other three.* Identical math, zero UI. Same answer for partial payments.

**Why it matters more than it looks:** the custom-split screen is where the third flow sneaks in. The house rule is a maximum of two flows — write a line, settle a number — and an itemiser is a third path to value dressed as a detail view. Costs the user four seconds a month. Saves an entire feature area, and the feature area is the one that made Splitwise confusing in the first place.

**Lesson:** when the object in the metaphor doesn't have the feature, check whether the feature was ever real. The shopkeeper doesn't have an itemiser. He writes two lines.

---

## 2026-07-15 — Roster and khaata are different lists

**Context:** "If someone moves out without paying, his name stays there with the amount he owes." Straightforward, but a literal reading breaks something: Dev moved out, so he shouldn't be defaulted into Thursday's dinner line.

**Resolution:** two lists, never merged. *Roster* = who gets defaulted into new lines; leaving is always allowed, no conditions. *Khaata* = who has a non-zero number; derived, and removable by nobody, ever. There is no delete-person. There is only "he doesn't shop here anymore." The number outlives the roster.

**Lesson:** slightly brutal, entirely authentic. Real khatas have names that have owed since 2019. Gone-but-not-settled gets its own greyed zone on the person page and stays there until it's zero.

---

## 2026-07-15 — Step 1 built: the engine needs no "extra" bookkeeping

**Context:** First code. Schema + the pure balance function, TDD, 16 tests green.

**Observation:** The splitting rule reads like two moves — give everyone `share`, then hand the `extra` rupee to the payer. Writing it that way, the extra wanted its own line of code and a branch for "is the payer even in the split?". It turned out to need neither. If each *non-payer* member simply owes the payer `floor(amount/n)`, the remainder is absorbed automatically: the payer paid the whole amount and only recovers the shares, so whatever doesn't divide evenly stays on the payer by construction — whether or not they're one of the splitters. The `%` never has to be computed.

**Resolution:** `applyExpense` records one debt per non-payer member and nothing else. Liveness (strikes, and strikes-of-strikes) is a small memoised recursion over the target DAG; balances just skip non-live rows. No stored balance, no status lookups — `personBalances` and `groupBalances` are pure functions of the entry list, which is what makes reopening a dissolved trip free.

**Lesson:** when the metaphor says "the payer absorbs the remainder," that's not a step to implement — it's a property to *not break*. The cleanest code for a rule is often the one that lets the rule happen rather than enforcing it.

---

## 2026-07-15 — Step 3: the open line, and the payer the spec doesn't mention

**Context:** Built the write flow. §4 describes Likhna precisely — type `Petrol 2400` on the always-open line, tap the cast to leave someone off, Enter commits — but it never says *who paid*. The expense schema needs a `payer_id`, and nothing in the two-flow UI selects one.

**Decision (mine, flag it):** the payer of a written line defaults to the current device person — you're logging what *you* paid, which is the overwhelmingly common case and needs zero extra taps. Implemented that; there is no payer picker.

**The tension:** the journal's own guest scenario breaks this. Rohan paid for petrol and will never install the app, so "someone in the cast writes his line for him" — which means the writer must be able to say *Rohan* paid, not themselves. With payer = current person, that line can't be recorded truthfully. So payer selection is genuinely needed, but adding a picker risks a third flow, which §2 forbids.

**Left open, on purpose:** shipped the default (payer = you) and deferred the "someone else paid" gesture rather than bolt on a picker under time pressure. A likely-clean answer: the cast strip already shows every name, so *tapping a name once* could leave them off the split (current behaviour) and *holding / a second state* could mark them the payer — one strip, no new screen. Not decided yet; it wants a real think, not a reflex.

**Also decided small:** after a commit the cast resets to the full roster. Persisting a reduced cast across lines is exactly what Sessions (step 8) are for; doing it ad-hoc now would be a worse version of that feature.

**Lesson:** the spec being silent on payer isn't an oversight to paper over — it's the same "don't grow a third flow" pressure showing up in a new place. Record the gap, ship the honest default, don't invent UI to fill a hole the design might want filled differently.

---

## 2026-07-15 — Step 4: the settlement is what makes the working add up

**Context:** Built the person page — one net number per person, the breakdown beneath. The number nets *everything*, settlements included. The per-group breakdown lines are gross (settlements aren't allocated to groups — §12). So the obvious worry: the working won't sum to the total the moment anyone settles. Ravi owes 900 in Goa and 10,000 in Ghar but his real number is 5,900, and 900 + 10,000 ≠ 5,900.

**Resolution:** don't try to make the groups absorb the settlement — show the settlement as its own line in the breakdown. "Goa: owes you 900 / Ghar: owes you 10,000 / Ravi paid you 5,000" reads top to bottom and lands on 5,900. The gap between gross-groups and net-total isn't a bug to hide; it *is* the settlement, and naming it is exactly the "show the working" rule. Wrote a test asserting every person's lines sum to their net, so this can't silently drift.

**Why it matters:** this is the §12 tension (person nets, groups stay gross) showing up in the UI, and it resolved the same way the spec resolved it in the data model — by refusing to allocate settlements to groups and instead letting them be their own person-level fact. The consistency is a good sign the model is right.

**Lesson:** when a total and its parts don't match, the reconciling term is usually a real thing that deserves its own line, not rounding to sweep away. Here it was the payment itself.

---

## 2026-07-15 — The book: navigation became the metaphor's last missing piece

**Context:** Avish asked for two things at once: the missing add-group flow, and page-turn navigation — swipe right-to-left from your profile to the groups list, tap into a ledger, swipe back, each with a physical page turn.

**Why this is more than polish:** we'd been navigating with URLs (`/` and `/hisaab/goa`), which is web-shaped, not book-shaped. A khata isn't three separate documents; it's one bound object you leaf through. Making home a `Book` component that *turns* between Accounts → Hisaabs → a ledger made the object model and the navigation the same thing. Fifth time the metaphor and the engineering have converged, for anyone counting.

**What it forced, usefully:** page state had been trapped per-route — writes vanished when you navigated. The book has to own the log to turn pages over it, so `entries/people/hisaabs/members` lifted into it, and suddenly a line written in Manali shows up in the groups list standing and the profile nets without any plumbing. The animation demanded the architecture the app wanted anyway.

**Add-group is a composer, not a flow:** name line, rolling/trip chips, cast chips, an add-a-name line — all on the ruled grid, no modal, no screen stack. Deity alternates by count and is sticky, per §7. Creating turns you straight into the fresh page, which is exactly the "moment of opening a page" §8 talks about.

**One trap for the record:** the strike-hover preview was written against `button.entry`, and the groups page reuses `.entry` rows as buttons — so hovering "Goa" previewed striking it. Scoped the preview to `button.entry.expense`. When a class stops meaning one thing, specificity bugs follow.

**Lesson:** when a UI gesture keeps insisting (swipe = turn a page), check whether it's actually the data model asking for a different owner. Here the "animation request" was really "the book should hold the ledger" — and both problems solved each other.

---

## 2026-07-16 — Identity was global; it should have been scoped from day one

**Context:** Avish reported it plainly: Ravi could open the app, type "Lalla" (someone else's name from a totally different trip), and be let straight in — seeing every hisaab and every person in the whole system. Also flagged: the "switch identity" button had no business existing, and the home page needed to actually lead with a name and a number.

**What was actually wrong:** not the trust model — CLAUDE.md §2 already accepts that a tapped name can be a lie, same as someone grabbing the physical notebook. The bug was that identity had no *boundary*. The very first "Who are you?" screen was a single global directory of every person ever created, across every hisaab, and picking one dropped you into the entire database — every group, every ledger, no membership check anywhere. §6 already specifies the fix (join links, scoped per hisaab); step 5 shipped identity without it.

**Resolution:** two identity paths, never a directory of strangers.
- **Bootstrap** (bare `/`, no hisaab context): you can only *write* your own name. No list to browse — there is nothing to pick that isn't yours.
- **Join link** (`/join/<hisaabId>`, the actual shared secret per §6): shows only that one hisaab's roster, plus "add new" for a genuine guest. An already-identified device skips the chooser and is just added to the roster.

`Book` now derives `myHisaabs`/`myPeople` from `hisaab_members` every render and scopes every page to it; opening a hisaab you're not a member of renders nothing. The "switch" button — my own testing convenience, never part of the spec — is gone; identity is sticky per device, as intended.

**A race condition hid inside the fix.** The join-as-new-guest path creates a person and a membership row back to back; those are two separate async inserts with no ordering guarantee, so the membership's foreign key could reach Postgres before the person row did. Worse: an effect meant only for "already-signed-in device opens a join link" was also firing the instant `joinAsNew` set the new identity, so *two* membership inserts raced each other — the second colliding on the primary key. Both needed fixing: await the person insert before anything references it, and make the explicit join functions mark the auto-join effect as already-handled so it can't double-fire. Caught by actually reading the raw error text instead of trusting a shallow console log, and confirmed by querying the table directly rather than trusting the optimistic UI.

**Lesson:** "no accounts, no passwords" (§2) and "no directory of strangers" are two different guarantees, and I'd only built the first. A trust object still needs a boundary around *which* trust circle you're in — the shopkeeper's book is passed to one shop's regulars, not laid open on the street. Also: when a bug report says "there's no authentication," don't reach for auth — check whether scope, not identity, is what's actually missing.

---

## 2026-07-16 — Step 5: persistence was cheap because the log was append-only

**Context:** Wired the log to Supabase. The whole storage layer is `fetchAll` + four `insert`s + a realtime subscription — no update paths, no conflict resolution, no migrations of derived state. This is the append-only bet from day one paying out: writes are inserts, balances are recomputed on read, so "sync" is just "append the same rows everywhere."

**The one real decision — RLS with no auth.** §9 says "RLS scoped by hisaab membership," but §2 says no accounts — identity is a name you tap, stored on the device. Those can't both be fully true without auth. Rather than bolt on Supabase Auth (which the metaphor rejects — the shopkeeper doesn't check ID), the v1 posture is: anyone with the anon key can read and *append*, and RLS enforces the thing that actually matters — the ledger is append-only. `entries` gets select + insert policies and deliberately *no* update/delete, so "you cannot un-write ink" is guaranteed by Postgres, not by our client code. The knowledge that someone could tap the wrong name is the same risk as someone grabbing the physical notebook — acceptable for a trust object. If real per-group privacy is ever needed, that's when auth (or signed join tokens) comes in.

**Verified live**, not just typechecked: signed in by writing a name → reloaded → the name came back from the DB; created a hisaab, wrote a line → reloaded → both there. React state resets on reload, so anything that survives came from Postgres.

**Small footgun caught:** the automated browser kept autofilling the name field ("Lalla" instead of what was typed). Browsers treat a field labelled "name" as a contact field. Added `autocomplete="off"` to every ledger input — a khata should never offer to autofill.

**Lesson:** an architecture decision made for one reason (append-only, so corrections are honest) keeps paying rent in places you didn't plan for. Offline sync, realtime, and "no migrations ever" all fell out of it for free. Worth remembering when the cheap-but-mutable option tempts early.
