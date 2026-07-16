import type { Entry, Hisaab, HisaabMember, Person } from "./types";
import { personBalances, groupBalances, liveEntries, netBetween } from "./balance";

// Builds the person page: for the current person, one net number per other
// person (the number), then the per-group and settlement lines that make it up
// (the working). Everything is derived from the entry log at read time.

/** One line of the working. `youOwe` is signed: + = you owe, − = they owe you. */
export interface BreakdownLine {
  kind: "group" | "settlement";
  hisaabId?: string;
  label: string;
  youOwe: number;
}

export interface PersonSummary {
  person: Person;
  youOwe: number; // signed net across everything: + you owe them, − they owe you
  lines: BreakdownLine[];
}

export interface PersonPageView {
  active: PersonSummary[];
  old: PersonSummary[]; // off every roster, still non-zero
}

const byMagnitude = (a: PersonSummary, b: PersonSummary) =>
  Math.abs(b.youOwe) - Math.abs(a.youOwe);

export function buildPersonPage(
  entries: Entry[],
  people: Person[],
  hisaabs: Hisaab[],
  members: HisaabMember[],
  meId: string,
): PersonPageView {
  const pairs = personBalances(entries);
  const live = liveEntries(entries);
  const onSomeRoster = (pid: string) =>
    members.some((m) => m.personId === pid && m.onRoster);

  const active: PersonSummary[] = [];
  const old: PersonSummary[] = [];

  for (const p of people) {
    if (p.id === meId) continue;
    const youOwe = netBetween(pairs, meId, p.id);
    if (youOwe === 0) continue; // nothing between you two → not on this page

    const lines: BreakdownLine[] = [];

    // Per-group nets (gross expenses; settlements are not allocated to groups).
    for (const h of hisaabs) {
      const g = netBetween(groupBalances(entries, h.id), meId, p.id);
      if (g !== 0) {
        lines.push({ kind: "group", hisaabId: h.id, label: h.name, youOwe: g });
      }
    }

    // Settlements between the two of you, each shown as its own line so the
    // working still adds up to the total.
    for (const e of live) {
      if (e.kind !== "settlement" || e.amount == null) continue;
      if (e.payerId === meId && e.payeeId === p.id) {
        lines.push({ kind: "settlement", label: `you paid ${p.name}`, youOwe: -e.amount });
      } else if (e.payerId === p.id && e.payeeId === meId) {
        lines.push({ kind: "settlement", label: `${p.name} paid you`, youOwe: e.amount });
      }
    }

    const summary: PersonSummary = { person: p, youOwe, lines };
    (onSomeRoster(p.id) ? active : old).push(summary);
  }

  active.sort(byMagnitude);
  old.sort(byMagnitude);
  return { active, old };
}
