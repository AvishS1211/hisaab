import { describe, it, expect } from "vitest";
import type { Entry } from "./types";
import {
  personBalances,
  groupBalances,
  liveEntryIds,
  netBetween,
} from "./balance";

// ── test helpers ────────────────────────────────────────────────────────────
// People and hisaabs are just string ids to the engine; readable names keep the
// cases legible. `authoredBy`/`createdAt` don't affect balances, so we fill them.

let seq = 0;
const id = () => `e${++seq}`;

function expense(
  hisaabId: string,
  amount: number,
  payerId: string,
  splitIds: string[],
  label = "x",
): Entry {
  return {
    id: id(),
    hisaabId,
    kind: "expense",
    label,
    amount,
    payerId,
    splitIds,
    authoredBy: payerId,
    createdAt: new Date().toISOString(),
  };
}

function settlement(payerId: string, payeeId: string, amount: number): Entry {
  return {
    id: id(),
    hisaabId: null, // settlements are person-level; never allocated to a group
    kind: "settlement",
    amount,
    payerId,
    payeeId,
    authoredBy: payerId,
    createdAt: new Date().toISOString(),
  };
}

function strike(targetId: string, authoredBy = "A"): Entry {
  return {
    id: id(),
    hisaabId: null,
    kind: "strike",
    targetId,
    authoredBy,
    createdAt: new Date().toISOString(),
  };
}

// ── splitting, exactly ──────────────────────────────────────────────────────

describe("splitting", () => {
  it("splits an even amount into equal shares", () => {
    const pairs = personBalances([expense("goa", 300, "A", ["A", "B", "C"])]);
    expect(netBetween(pairs, "B", "A")).toBe(100);
    expect(netBetween(pairs, "C", "A")).toBe(100);
    expect(pairs).toHaveLength(2); // A owes nobody
  });

  it("gives each member the floor share and lets the payer absorb the remainder", () => {
    // ₹100 across 3 = 34/33/33, extra rupee to the payer.
    const pairs = personBalances([expense("goa", 100, "A", ["A", "B", "C"])]);
    expect(netBetween(pairs, "B", "A")).toBe(33);
    expect(netBetween(pairs, "C", "A")).toBe(33);
    // Payer recovers 66 of 100 → absorbs 34. No debt records the extra.
    expect(pairs).toHaveLength(2);
  });

  it("absorbs the remainder onto a payer who is not in the split", () => {
    // Rohan (R) paid; the line is split across three others.
    const pairs = personBalances([expense("goa", 100, "R", ["B", "C", "D"])]);
    expect(netBetween(pairs, "B", "R")).toBe(33);
    expect(netBetween(pairs, "C", "R")).toBe(33);
    expect(netBetween(pairs, "D", "R")).toBe(33);
    // R recovers 99 of 100, absorbing 1.
    const recovered = pairs.reduce((s, p) => s + p.amount, 0);
    expect(recovered).toBe(99);
  });

  it("records an unequal split as two independent lines (no custom-split screen)", () => {
    // Ravi's ₹800 steak; the other three share ₹600 of dosas.
    const pairs = personBalances([
      expense("goa", 800, "P", ["Ravi"], "steak"), // Ravi owes payer P 800
      expense("goa", 600, "P", ["A", "B", "C"], "dosa"), // 200 each
    ]);
    expect(netBetween(pairs, "Ravi", "P")).toBe(800);
    expect(netBetween(pairs, "A", "P")).toBe(200);
    expect(netBetween(pairs, "B", "P")).toBe(200);
    expect(netBetween(pairs, "C", "P")).toBe(200);
  });
});

// ── pairwise netting, never across pairs ────────────────────────────────────

describe("pairwise netting", () => {
  it("nets two groups pairwise without simplifying debts", () => {
    // Ghar: Ravi owes You 200. Goa: You owe Ravi 340. Net: You owe Ravi 140.
    const entries = [
      expense("ghar", 400, "You", ["You", "Ravi"]),
      expense("goa", 680, "Ravi", ["You", "Ravi"]),
    ];
    const person = personBalances(entries);
    expect(netBetween(person, "You", "Ravi")).toBe(140);
    expect(person).toHaveLength(1);

    // Groups stay independent and gross.
    expect(netBetween(groupBalances(entries, "ghar"), "Ravi", "You")).toBe(200);
    expect(netBetween(groupBalances(entries, "goa"), "You", "Ravi")).toBe(340);
  });

  it("never invents a transfer between people who did not transact", () => {
    // A paid for A+B; C paid for C+D. A–B and C–D transact; A–C never do.
    const entries = [
      expense("h", 200, "A", ["A", "B"]),
      expense("h", 200, "C", ["C", "D"]),
    ];
    const person = personBalances(entries);
    expect(netBetween(person, "B", "A")).toBe(100);
    expect(netBetween(person, "D", "C")).toBe(100);
    expect(netBetween(person, "A", "C")).toBe(0);
    expect(person).toHaveLength(2);
  });
});

// ── settlements ─────────────────────────────────────────────────────────────

describe("settlements", () => {
  it("moves the person-level balance immediately and leaves group pages gross", () => {
    const entries: Entry[] = [
      expense("ghar", 400, "You", ["You", "Ravi"]), // Ravi owes You 200
      expense("goa", 680, "Ravi", ["You", "Ravi"]), // You owe Ravi 340
      settlement("You", "Ravi", 140), // You pay Ravi the net
    ];
    // Person page zeroes out.
    expect(personBalances(entries)).toHaveLength(0);
    // Group pages are untouched by settlements.
    expect(netBetween(groupBalances(entries, "ghar"), "Ravi", "You")).toBe(200);
    expect(netBetween(groupBalances(entries, "goa"), "You", "Ravi")).toBe(340);
  });

  it("can overshoot and flip the direction of a balance", () => {
    const entries: Entry[] = [
      expense("h", 200, "A", ["A", "B"]), // B owes A 100
      settlement("B", "A", 250), // B overpays
    ];
    // B now sits 150 ahead: A owes B 150.
    expect(netBetween(personBalances(entries), "A", "B")).toBe(150);
  });
});

// ── strikes ─────────────────────────────────────────────────────────────────

describe("strikes", () => {
  it("drops an entry that has a live strike against it", () => {
    const e = expense("h", 300, "A", ["A", "B", "C"]);
    expect(personBalances([e, strike(e.id)])).toHaveLength(0);
  });

  it("restores an entry when the strike is itself struck (undo)", () => {
    const e = expense("h", 300, "A", ["A", "B", "C"]);
    const s = strike(e.id);
    const undo = strike(s.id);
    const pairs = personBalances([e, s, undo]);
    expect(netBetween(pairs, "B", "A")).toBe(100);
    expect(netBetween(pairs, "C", "A")).toBe(100);
  });

  it("re-strikes after an undo (strike → undo → strike)", () => {
    const e = expense("h", 300, "A", ["A", "B", "C"]);
    const s1 = strike(e.id);
    const s2 = strike(s1.id); // undo
    const s3 = strike(s2.id); // undo the undo → e is struck again
    expect(personBalances([e, s1, s2, s3])).toHaveLength(0);
  });

  it("can strike a settlement", () => {
    const entries: Entry[] = [
      expense("h", 200, "A", ["A", "B"]), // B owes A 100
      settlement("B", "A", 100), // clears it
    ];
    expect(personBalances(entries)).toHaveLength(0);
    const struck = [...entries, strike(entries[1]!.id)];
    expect(netBetween(personBalances(struck), "B", "A")).toBe(100);
  });

  it("exposes live ids for the struck-but-visible render", () => {
    const e = expense("h", 300, "A", ["A", "B", "C"]);
    const s = strike(e.id);
    const live = liveEntryIds([e, s]);
    // The expense is dropped from balances but both rows still exist to render.
    expect(live.has(e.id)).toBe(false);
    expect(live.has(s.id)).toBe(true);
  });
});

// ── decided edge cases (CLAUDE.md §10) ──────────────────────────────────────

describe("decided edge cases", () => {
  it("does not dedup offline duplicates; a strike resolves them", () => {
    const a = expense("h", 2400, "A", ["A", "B"], "Petrol");
    const b = expense("h", 2400, "A", ["A", "B"], "Petrol"); // same drive, synced twice
    // Both count until someone strikes one.
    expect(netBetween(personBalances([a, b]), "B", "A")).toBe(2400);
    expect(netBetween(personBalances([a, b, strike(b.id)]), "B", "A")).toBe(1200);
  });

  it("is agnostic to hisaab status: reopening a dissolved trip recomputes for free", () => {
    // Status lives on `hisaabs`, not `entries`; the engine reads only entries,
    // so dissolving and reopening migrate nothing and change no balance.
    const entries = [expense("goa", 680, "Ravi", ["You", "Ravi"])];
    const before = personBalances(entries);
    const afterReopen = personBalances(entries); // identical inputs, no migration
    expect(afterReopen).toEqual(before);
    expect(netBetween(afterReopen, "You", "Ravi")).toBe(340);
  });

  it("keeps a moved-out person's balance until it is zero", () => {
    // Dev is off-roster but still owes; the engine has no notion of roster and
    // simply keeps deriving his number.
    const entries: Entry[] = [expense("ghar", 300, "A", ["A", "Dev"])];
    expect(netBetween(personBalances(entries), "Dev", "A")).toBe(150);
    const cleared = [...entries, settlement("Dev", "A", 150)];
    expect(personBalances(cleared)).toHaveLength(0);
  });
});
