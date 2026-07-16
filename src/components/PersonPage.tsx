"use client";

import { useState } from "react";
import type { Entry, Hisaab, HisaabMember, Person } from "../lib/types";
import { buildPersonPage, type PersonSummary, type BreakdownLine } from "../lib/personView";
import { deityLine } from "../lib/deity";

const inr = (n: number) => n.toLocaleString("en-IN");

// A signed "you owe / owes you" phrase. Lead with the number, say the direction.
function direction(youOwe: number): { verb: string; amount: number } {
  return youOwe > 0
    ? { verb: "you owe", amount: youOwe }
    : { verb: "owes you", amount: -youOwe };
}

// The person page (profile): net per person, then the working, then Old accounts.
// Tapping a person's number settles (Chukta): write the payment, balance moves
// immediately — no confirm. State is owned by the Book. (§2, §4.)
export function PersonPage({
  entries,
  setEntries,
  people,
  hisaabs,
  members,
  currentPersonId,
  onOpenHisaab,
}: {
  entries: Entry[];
  setEntries: React.Dispatch<React.SetStateAction<Entry[]>>;
  people: Person[];
  hisaabs: Hisaab[];
  members: HisaabMember[];
  currentPersonId: string;
  onOpenHisaab?: (hisaabId: string) => void;
}) {
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const { active, old } = buildPersonPage(entries, people, hisaabs, members, currentPersonId);

  function startSettle(s: PersonSummary) {
    if (settlingId === s.person.id) {
      setSettlingId(null);
      return;
    }
    setSettlingId(s.person.id);
    setDraft(String(Math.abs(s.youOwe)));
  }

  function commitSettle(s: PersonSummary) {
    const amount = parseInt(draft.replace(/,/g, ""), 10);
    if (!Number.isInteger(amount) || amount <= 0) return;
    const youPay = s.youOwe > 0;
    const entry: Entry = {
      id: crypto.randomUUID(),
      hisaabId: null,
      kind: "settlement",
      amount,
      payerId: youPay ? currentPersonId : s.person.id,
      payeeId: youPay ? s.person.id : currentPersonId,
      authoredBy: currentPersonId,
      createdAt: new Date().toISOString(),
    };
    setEntries((prev) => [...prev, entry]);
    setSettlingId(null);
    setDraft("");
  }

  function renderBreakdown(line: BreakdownLine, i: number, muted: boolean) {
    const d = direction(line.youOwe);
    const cls = muted ? "break old" : "break";
    const amount = (
      <span className="break-amt">
        <span className="dir">{line.kind === "settlement" ? line.label : d.verb}</span>
        <span className="amt">
          {inr(line.kind === "settlement" ? Math.abs(line.youOwe) : d.amount)}
        </span>
      </span>
    );
    if (line.kind === "group" && line.hisaabId && onOpenHisaab) {
      const hisaabId = line.hisaabId;
      return (
        <button key={i} type="button" className={cls} onClick={() => onOpenHisaab(hisaabId)}>
          <span className="label">{line.label}</span>
          {amount}
        </button>
      );
    }
    return (
      <div key={i} className={cls}>
        <span className="label">{line.kind === "group" ? line.label : ""}</span>
        {amount}
      </div>
    );
  }

  function renderPerson(s: PersonSummary, muted: boolean) {
    const d = direction(s.youOwe);
    const settling = settlingId === s.person.id;
    const youPay = s.youOwe > 0;
    return (
      <div key={s.person.id}>
        <div className={muted ? "person old" : "person"}>
          <span className="who">{s.person.name}</span>
          <button
            type="button"
            className="net"
            aria-label={`Settle with ${s.person.name}`}
            aria-expanded={settling}
            onClick={() => startSettle(s)}
          >
            <span className="dir">{d.verb}</span>
            <span className="amt">{inr(d.amount)}</span>
          </button>
        </div>

        {settling && (
          <div className="entry settle-row">
            <span className="settle-verb">
              {youPay ? `you pay ${s.person.name}` : `${s.person.name} pays you`}
            </span>
            <input
              className="open-input settle-input"
              value={draft}
              inputMode="numeric"
              autoFocus
              aria-label="Payment amount"
              onFocus={(e) => e.target.select()}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitSettle(s);
                } else if (e.key === "Escape") {
                  setSettlingId(null);
                }
              }}
              onBlur={() => setSettlingId(null)}
            />
          </div>
        )}

        {s.lines.map((line, i) => renderBreakdown(line, i, muted))}
        <div className="spacer-1" />
      </div>
    );
  }

  return (
    <main className="sheet">
      <div className="spacer-1" />
      <div className="deity">{deityLine.ganesh}</div>
      <div className="title-row">
        <span className="title">Accounts</span>
      </div>
      <div className="spacer-1" />

      {active.length === 0 && old.length === 0 && (
        <div className="entry"><span className="label empty-note">All settled up.</span></div>
      )}

      {active.map((s) => renderPerson(s, false))}

      {old.length > 0 && (
        <>
          <div className="title-row">
            <span className="title">Old accounts</span>
          </div>
          <div className="spacer-1" />
          {old.map((s) => renderPerson(s, true))}
        </>
      )}
    </main>
  );
}
