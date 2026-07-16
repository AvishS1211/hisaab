import type { Entry, PairBalance } from "./types";

// The balance engine. Pure, no cache, recomputed on every read. This file is
// the whole app; everything else is a view onto what it returns. See CLAUDE.md
// §3 for the rules it implements.

/**
 * An entry is *live* unless a live strike points at it.
 *
 * Strikes can themselves be struck (an undo), so liveness is recursive: entry E
 * is struck iff some strike S with `targetId === E.id` is itself live. We
 * memoise because the target chain is a DAG (a strike only ever references an
 * entry that already exists).
 */
export function liveEntryIds(entries: Entry[]): Set<string> {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const strikesByTarget = new Map<string, Entry[]>();
  for (const e of entries) {
    if (e.kind === "strike" && e.targetId) {
      const list = strikesByTarget.get(e.targetId) ?? [];
      list.push(e);
      strikesByTarget.set(e.targetId, list);
    }
  }

  const memo = new Map<string, boolean>();
  const isLive = (id: string): boolean => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    // Guard against a malformed cycle: assume live until proven struck.
    memo.set(id, true);
    const strikes = strikesByTarget.get(id) ?? [];
    const struck = strikes.some((s) => isLive(s.id));
    const live = !struck;
    memo.set(id, live);
    return live;
  };

  const result = new Set<string>();
  for (const e of entries) {
    if (byId.has(e.id) && isLive(e.id)) result.add(e.id);
  }
  return result;
}

/** Live entries only, preserving input order. */
export function liveEntries(entries: Entry[]): Entry[] {
  const live = liveEntryIds(entries);
  return entries.filter((e) => live.has(e.id));
}

// Signed pairwise ledger keyed by a canonical (lo|hi) person pair. The stored
// number is "how much `lo` owes `hi`" — negative means `hi` owes `lo`. Netting
// pairs this way guarantees we never invent a transfer between two people who
// did not transact (no debt simplification — CLAUDE.md §2).
type Ledger = Map<string, number>;

function pairKey(a: string, b: string): { key: string; sign: 1 | -1 } {
  // sign is +1 when a is the canonical `lo`, so `a owes b` adds positively.
  return a < b ? { key: `${a}|${b}`, sign: 1 } : { key: `${b}|${a}`, sign: -1 };
}

function addDebt(ledger: Ledger, debtor: string, creditor: string, amount: number): void {
  if (debtor === creditor || amount === 0) return;
  const { key, sign } = pairKey(debtor, creditor);
  ledger.set(key, (ledger.get(key) ?? 0) + sign * amount);
}

/**
 * Split an expense across its members and record who owes the payer.
 *
 *   share = amount / n   (integer division)
 *   extra = amount % n   → absorbed by the payer
 *
 * Each non-payer member owes the payer exactly `share`. The extra is never a
 * debt: by construction it stays with the payer, who paid the full amount and
 * recovers only the shares. If the payer is not among the split, they absorb
 * the remainder as their own cost. No paise, no decimals ever. (CLAUDE.md §3.)
 */
function applyExpense(ledger: Ledger, entry: Entry): void {
  const { amount, payerId, splitIds } = entry;
  if (amount == null || !payerId || !splitIds || splitIds.length === 0) return;
  const share = Math.floor(amount / splitIds.length);
  for (const member of splitIds) {
    addDebt(ledger, member, payerId, share);
  }
}

/** A settlement means the sender owed the receiver `amount` less. */
function applySettlement(ledger: Ledger, entry: Entry): void {
  const { amount, payerId, payeeId } = entry;
  if (amount == null || !payerId || !payeeId) return;
  addDebt(ledger, payerId, payeeId, -amount);
}

function ledgerToPairs(ledger: Ledger): PairBalance[] {
  const pairs: PairBalance[] = [];
  for (const [key, net] of ledger) {
    if (net === 0) continue;
    const [lo, hi] = key.split("|") as [string, string];
    // Positive net = lo owes hi; negative = hi owes lo.
    if (net > 0) pairs.push({ from: lo, to: hi, amount: net });
    else pairs.push({ from: hi, to: lo, amount: -net });
  }
  return pairs;
}

/**
 * Person-level balances across everything: all live expenses (any hisaab) plus
 * all live settlements, netted pairwise. This is what the person page shows.
 */
export function personBalances(entries: Entry[]): PairBalance[] {
  const ledger: Ledger = new Map();
  for (const e of liveEntries(entries)) {
    if (e.kind === "expense") applyExpense(ledger, e);
    else if (e.kind === "settlement") applySettlement(ledger, e);
  }
  return ledgerToPairs(ledger);
}

/**
 * Group-level balances for a single hisaab: only that hisaab's live expenses,
 * netted pairwise. Settlements are person-level and never allocated to a group,
 * so a group page shows the expenses it generated — gross, forever. A *page* is
 * never "settled"; only a running total is. (CLAUDE.md §3, §12.)
 */
export function groupBalances(entries: Entry[], hisaabId: string): PairBalance[] {
  const ledger: Ledger = new Map();
  for (const e of liveEntries(entries)) {
    if (e.kind === "expense" && e.hisaabId === hisaabId) applyExpense(ledger, e);
  }
  return ledgerToPairs(ledger);
}

/** Net amount `a` owes `b` in a set of pair balances (negative if `b` owes `a`). */
export function netBetween(pairs: PairBalance[], a: string, b: string): number {
  let total = 0;
  for (const p of pairs) {
    if (p.from === a && p.to === b) total += p.amount;
    else if (p.from === b && p.to === a) total -= p.amount;
  }
  return total;
}
