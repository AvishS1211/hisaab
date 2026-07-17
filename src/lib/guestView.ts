import type { Entry, Hisaab, Person } from "./types";
import { groupBalances, liveEntries, netBetween } from "./balance";

// Builds the guest render for a view link (CLAUDE.md §6): one person's page of
// one hisaab. Not a stripped hisaab page — a distinct read-only render. Shows
// only the lines that person is actually part of, what was really paid, and
// their one net number for this hisaab. Never the whole group.

export interface GuestLine {
  label: string;
  amount: number; // the full expense amount
  payerName: string;
  isPayer: boolean; // this person paid it
  share: number; // this person's share of it
}

export interface GuestView {
  personName: string;
  hisaabName: string;
  net: number; // + = they owe, - = they're owed, this hisaab only (gross, no settlements — §3)
  lines: GuestLine[];
}

export function buildGuestView(
  entries: Entry[],
  people: Person[],
  hisaab: Hisaab,
  personId: string,
): GuestView {
  const nameOf = (id: string | null | undefined) =>
    people.find((p) => p.id === id)?.name ?? "?";

  const expenses = liveEntries(entries).filter(
    (e) =>
      e.kind === "expense" &&
      e.hisaabId === hisaab.id &&
      (e.payerId === personId || (e.splitIds ?? []).includes(personId)),
  );

  const lines: GuestLine[] = expenses.map((e) => {
    const n = e.splitIds?.length || 1;
    return {
      label: e.label ?? "",
      amount: e.amount ?? 0,
      payerName: nameOf(e.payerId),
      isPayer: e.payerId === personId,
      share: Math.floor((e.amount ?? 0) / n),
    };
  });

  const pairs = groupBalances(entries, hisaab.id);
  const net = people.reduce(
    (t, p) => (p.id === personId ? t : t + netBetween(pairs, personId, p.id)),
    0,
  );

  return { personName: nameOf(personId), hisaabName: hisaab.name, net, lines };
}
