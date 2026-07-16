import type { Person, Hisaab, HisaabMember, Entry } from "./types";

// Hardcoded seed for steps 2–4 (pre-Supabase). Two hisaabs so the person page
// can show cross-group netting, a settlement, and an "Old accounts" entry.

export const people: Person[] = [
  { id: "p_you", name: "Avish", createdAt: "2026-07-10T09:00:00Z" },
  { id: "p_ravi", name: "Ravi", createdAt: "2026-07-10T09:00:00Z" },
  { id: "p_dev", name: "Dev", createdAt: "2026-07-10T09:00:00Z" },
  { id: "p_rohan", name: "Rohan", createdAt: "2026-07-10T09:00:00Z" },
  // Moved out of the flat still owing — off every roster, non-zero. Old account.
  { id: "p_sameer", name: "Sameer", createdAt: "2026-05-01T09:00:00Z" },
];

export const personName = (id: string): string =>
  people.find((p) => p.id === id)?.name ?? "?";

export const goa: Hisaab = {
  id: "goa",
  name: "Goa",
  kind: "trip",
  deity: "ganesh",
  status: "open",
  createdAt: "2026-07-11T06:00:00Z",
};

export const ghar: Hisaab = {
  id: "ghar",
  name: "Ghar",
  kind: "rolling",
  deity: "lakshmi", // deities alternate; Goa took ganesh
  status: "open",
  createdAt: "2026-01-01T06:00:00Z",
};

export const hisaabs: Hisaab[] = [goa, ghar];

export const members: HisaabMember[] = [
  { hisaabId: "goa", personId: "p_you", onRoster: true },
  { hisaabId: "goa", personId: "p_ravi", onRoster: true },
  { hisaabId: "goa", personId: "p_dev", onRoster: true },
  { hisaabId: "goa", personId: "p_rohan", onRoster: true },
  { hisaabId: "ghar", personId: "p_you", onRoster: true },
  { hisaabId: "ghar", personId: "p_ravi", onRoster: true },
  { hisaabId: "ghar", personId: "p_dev", onRoster: true },
  { hisaabId: "ghar", personId: "p_sameer", onRoster: false }, // left the flat
];

// Who a hisaab's new lines default to (the cast) = its on-roster members.
export const rosterOf = (hisaabId: string): string[] =>
  members.filter((m) => m.hisaabId === hisaabId && m.onRoster).map((m) => m.personId);

export const roster: string[] = rosterOf("goa");

let t = Date.parse("2026-07-11T07:00:00Z");
const at = () => new Date((t += 3_600_000)).toISOString();

function expense(
  id: string,
  hisaabId: string,
  label: string,
  amount: number,
  payerId: string,
  splitIds: string[],
): Entry {
  return {
    id,
    hisaabId,
    kind: "expense",
    label,
    amount,
    payerId,
    splitIds,
    authoredBy: payerId,
    createdAt: at(),
  };
}

const goaRoster = rosterOf("goa");

export const entries: Entry[] = [
  // ── Goa (trip) ──
  expense("e_petrol", "goa", "Petrol", 2400, "p_ravi", goaRoster),
  // Offline duplicate — both synced, one struck (§10). Kept visible, struck.
  expense("e_petrol_dup", "goa", "Petrol", 2400, "p_ravi", goaRoster),
  expense("e_hotel", "goa", "Hotel", 6000, "p_you", goaRoster),
  // Unequal split as two lines (§2): Dev's steak, everyone's dosas.
  expense("e_steak", "goa", "Steak", 800, "p_dev", ["p_dev"]),
  expense("e_dosa", "goa", "Dosa", 600, "p_dev", ["p_you", "p_ravi", "p_rohan"]),
  expense("e_daru", "goa", "Daru", 3600, "p_rohan", ["p_you", "p_ravi", "p_rohan"]),
  expense("e_movie", "goa", "Movie", 300, "p_dev", goaRoster),
  {
    id: "s_petrol_dup",
    hisaabId: null,
    kind: "strike",
    targetId: "e_petrol_dup",
    authoredBy: "p_ravi",
    createdAt: at(),
  },

  // ── Ghar (rolling flat ledger) ──
  expense("e_rent", "ghar", "Rent", 30000, "p_you", ["p_you", "p_ravi", "p_dev"]),
  // A line from when Sameer still lived here — he owes You his half.
  expense("e_deposit", "ghar", "Deposit", 2000, "p_you", ["p_you", "p_sameer"]),

  // ── Settlement (person-level, hisaabId null) ──
  // Ravi paid You back part of what he owed.
  {
    id: "st_ravi_you",
    hisaabId: null,
    kind: "settlement",
    amount: 5000,
    payerId: "p_ravi",
    payeeId: "p_you",
    authoredBy: "p_ravi",
    createdAt: at(),
  },
];
