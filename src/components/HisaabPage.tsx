"use client";

import { useRef, useState } from "react";
import type { Entry, Hisaab, Person } from "../lib/types";
import { liveEntryIds } from "../lib/balance";
import { deityLine } from "../lib/deity";
import { parseLine } from "../lib/parseLine";

const inr = (n: number) => n.toLocaleString("en-IN");
const initial = (name: string) => name.slice(0, 1).toUpperCase();

// The hisaab page with the write flow. There is no add button: the next ruled
// line is always open with the cursor in it. Type "Petrol 2400", tap a name to
// leave them off this line, press Enter to commit. (CLAUDE.md §2, §4.)
//
// Entry state is owned by the Book; new lines are appended via setEntries.
export function HisaabPage({
  hisaab,
  entries,
  onAddEntries,
  people,
  roster,
  currentPersonId,
}: {
  hisaab: Hisaab;
  entries: Entry[];
  onAddEntries: (entries: Entry[]) => void;
  people: Person[];
  roster: string[];
  currentPersonId: string;
}) {
  const nameOf = (id: string | null | undefined) =>
    people.find((p) => p.id === id)?.name ?? "?";

  const [draft, setDraft] = useState("");
  // Who this next line is split across. Defaults to the full roster; tapping a
  // chip toggles that person off (or back on) for the line being written.
  const [cast, setCast] = useState<Set<string>>(() => new Set(roster));
  const inputRef = useRef<HTMLInputElement>(null);

  const live = liveEntryIds(entries);
  const expenses = entries.filter(
    (e) => e.kind === "expense" && e.hisaabId === hisaab.id,
  );
  const parsed = parseLine(draft);

  function toggleCast(id: string) {
    setCast((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    inputRef.current?.focus();
  }

  // Strike, don't delete. Tapping a line strikes it; tapping a struck line
  // strikes the strike (undo). Nothing is ever removed. (CLAUDE.md §3, §8.)
  function toggleStrike(target: Entry) {
    const struck = !live.has(target.id);
    const makeStrike = (targetId: string): Entry => ({
      id: crypto.randomUUID(),
      hisaabId: null,
      kind: "strike",
      targetId,
      authoredBy: currentPersonId,
      createdAt: new Date().toISOString(),
    });

    const additions: Entry[] = struck
      ? // undo: strike every live strike pointing at this line
        entries
          .filter((e) => e.kind === "strike" && e.targetId === target.id && live.has(e.id))
          .map((e) => makeStrike(e.id))
      : [makeStrike(target.id)];

    onAddEntries(additions);
  }

  function commit() {
    if (parsed.amount === null || cast.size === 0) return;
    const entry: Entry = {
      id: crypto.randomUUID(),
      hisaabId: hisaab.id,
      kind: "expense",
      label: parsed.label,
      amount: parsed.amount,
      payerId: currentPersonId,
      splitIds: roster.filter((id) => cast.has(id)),
      authoredBy: currentPersonId,
      createdAt: new Date().toISOString(),
    };
    onAddEntries([entry]);
    setDraft("");
    setCast(new Set(roster)); // next line starts from the full cast again
    inputRef.current?.focus();
  }

  return (
    <main className="sheet">
      <div className="spacer-1" />
      <div className="deity">{deityLine[hisaab.deity]}</div>
      <div className="title-row">
        <span className="title">
          {hisaab.name} <span className="kind">· {hisaab.kind}</span>
        </span>
      </div>
      <div className="spacer-1" />

      {expenses.map((e) => {
        const struck = !live.has(e.id);
        return (
          <button
            type="button"
            key={e.id}
            className={struck ? "entry expense struck" : "entry expense"}
            aria-label={struck ? `Undo strike on ${e.label}` : `Strike ${e.label}`}
            onClick={() => toggleStrike(e)}
          >
            <span className="payer">{initial(nameOf(e.payerId))}</span>
            <span className="label">{e.label}</span>
            <span className="amount">{inr(e.amount ?? 0)}</span>
          </button>
        );
      })}

      {/* The open line — always there, cursor in it. */}
      <div className="entry open-line">
        <span className="payer">{initial(nameOf(currentPersonId))}</span>
        <input
          ref={inputRef}
          className="open-input"
          value={draft}
          autoFocus
          spellCheck={false}
          placeholder="Chai 40"
          aria-label="Write a line"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
      </div>

      {/* Cast strip for the line being written. Struck = left off this line. */}
      <div className="cast-strip">
        {roster.map((id) => {
          const on = cast.has(id);
          return (
            <button
              key={id}
              type="button"
              className={on ? "cast-name" : "cast-name off"}
              onClick={() => toggleCast(id)}
            >
              {nameOf(id)}
            </button>
          );
        })}
      </div>

      <div className="spacer-2" />
    </main>
  );
}
