// Domain types mirroring db/schema.sql. Amounts are always integer rupees.

export type Deity = "ganesh" | "lakshmi";
export type HisaabKind = "rolling" | "trip";
export type HisaabStatus = "open" | "dissolved";
export type EntryKind = "expense" | "settlement" | "strike";

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
