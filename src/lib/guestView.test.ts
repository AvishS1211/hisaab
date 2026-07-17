import { describe, it, expect } from "vitest";
import type { Entry, Hisaab, Person } from "./types";
import { buildGuestView } from "./guestView";

const hisaab: Hisaab = {
  id: "goa",
  name: "Goa",
  kind: "trip",
  deity: "ganesh",
  status: "open",
  createdAt: "2026-07-11T06:00:00Z",
};

const people: Person[] = [
  { id: "dev", name: "Dev", createdAt: "" },
  { id: "rohan", name: "Rohan", createdAt: "" },
  { id: "you", name: "You", createdAt: "" },
  { id: "ravi", name: "Ravi", createdAt: "" },
];

let seq = 0;
const id = () => `e${++seq}`;
function expense(
  hisaabId: string | null,
  label: string,
  amount: number,
  payerId: string,
  splitIds: string[],
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
function strike(targetId: string): Entry {
  return {
    id: id(),
    hisaabId: null,
    kind: "strike",
    targetId,
    authoredBy: "dev",
    createdAt: new Date().toISOString(),
  };
}

describe("buildGuestView", () => {
  it("shows only lines the guest is actually part of, matching the JOURNAL render", () => {
    // Dev paid 1200 for a movie split four ways; Rohan is one of the four.
    const entries = [expense("goa", "Movie", 1200, "dev", ["dev", "rohan", "you", "ravi"])];
    const view = buildGuestView(entries, people, hisaab, "rohan");
    expect(view.personName).toBe("Rohan");
    expect(view.lines).toHaveLength(1);
    expect(view.lines[0]).toMatchObject({
      label: "Movie",
      amount: 1200,
      payerName: "Dev",
      isPayer: false,
      share: 300,
    });
    expect(view.net).toBe(300); // Rohan owes 300, this hisaab only
  });

  it("excludes expenses the guest has nothing to do with", () => {
    const entries = [
      expense("goa", "Movie", 1200, "dev", ["dev", "rohan"]),
      expense("goa", "Steak", 800, "dev", ["dev"]), // dev only — rohan not involved
    ];
    const view = buildGuestView(entries, people, hisaab, "rohan");
    expect(view.lines).toHaveLength(1);
    expect(view.lines[0]!.label).toBe("Movie");
  });

  it("marks the guest's own line as payer, not a debt", () => {
    const entries = [expense("goa", "Petrol", 2400, "rohan", ["rohan", "dev"])];
    const view = buildGuestView(entries, people, hisaab, "rohan");
    expect(view.lines[0]).toMatchObject({ isPayer: true, share: 1200 });
    expect(view.net).toBe(-1200); // Rohan is owed, not owing
  });

  it("excludes expenses from other hisaabs", () => {
    const entries = [
      expense("goa", "Movie", 300, "dev", ["dev", "rohan"]),
      expense("ghar", "Rent", 30000, "dev", ["dev", "rohan"]),
    ];
    const view = buildGuestView(entries, people, hisaab, "rohan");
    expect(view.lines).toHaveLength(1);
    expect(view.net).toBe(150); // only the Goa half
  });

  it("drops a struck expense entirely", () => {
    const e = expense("goa", "Movie", 300, "dev", ["dev", "rohan"]);
    const entries = [e, strike(e.id)];
    const view = buildGuestView(entries, people, hisaab, "rohan");
    expect(view.lines).toHaveLength(0);
    expect(view.net).toBe(0);
  });

  it("is gross — ignores settlements, which are person-level not hisaab-level (§3, §12)", () => {
    const entries: Entry[] = [
      expense("goa", "Movie", 300, "dev", ["dev", "rohan"]),
      {
        id: id(),
        hisaabId: null,
        kind: "settlement",
        amount: 150,
        payerId: "rohan",
        payeeId: "dev",
        authoredBy: "rohan",
        createdAt: new Date().toISOString(),
      },
    ];
    const view = buildGuestView(entries, people, hisaab, "rohan");
    expect(view.net).toBe(150); // unaffected by the settlement
  });
});
