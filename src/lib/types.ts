// Domain types mirroring db/schema.sql. Amounts are always integer rupees.

export type Deity = "ganesh" | "lakshmi";
export type HisaabKind = "rolling" | "trip";
export type HisaabStatus = "open" | "dissolved";
export type EntryKind = "expense" | "settlement" | "strike" | "session";

export interface Person {
  id: string;
  name: string;
  createdAt: string;
}

export interface Hisaab {
  id: string;
  name: string;
  kind: HisaabKind;
  deity: Deity;
  status: HisaabStatus;
  createdAt: string;
}

export interface HisaabMember {
  hisaabId: string;
  personId: string;
  onRoster: boolean;
}

/**
 * One line in the append-only log. The shape is a union in practice — the
 * `kind` decides which fields carry meaning:
 *
 *  - expense:    hisaabId, label, amount, payerId, splitIds
 *  - settlement: amount, payerId (sender), payeeId (receiver); hisaabId is null
 *  - strike:     targetId (the entry being struck)
 *  - session:    hisaabId, label (the divider text), splitIds (the new default
 *                cast from here on). No amount, no payer. See CLAUDE.md's
 *                Sessions section — no separate session table; this entry
 *                *is* the record, and the running default is derived by
 *                scanning for the most recent live one.
 *
 * Nothing here is ever mutated. Corrections are new `strike` rows; settlements
 * are new `settlement` rows. See CLAUDE.md §3.
 */
export interface Entry {
  id: string;
  hisaabId: string | null;
  kind: EntryKind;
  label?: string | null;
  amount?: number | null;
  payerId?: string | null;
  payeeId?: string | null;
  splitIds?: string[] | null;
  targetId?: string | null;
  authoredBy: string;
  createdAt: string;
}

/** A settled, directional balance: `from` owes `to` exactly `amount` rupees (> 0). */
export interface PairBalance {
  from: string;
  to: string;
  amount: number;
}
