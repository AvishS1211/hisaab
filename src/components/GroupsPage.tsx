"use client";

import { useRef, useState } from "react";
import type { Entry, Hisaab, HisaabKind, HisaabMember, Person } from "../lib/types";
import { groupBalances, netBetween } from "../lib/balance";
import { deityLine } from "../lib/deity";
import { inr } from "../lib/format";

// The list of hisaabs, and the one place a group is born. Naming a hisaab is a
// distinct moment (§7), so it gets a small composer — not one of the two flows.
export function GroupsPage({
  entries,
  people,
  hisaabs,
  members,
  currentPersonId,
  onAddPerson,
  onAddHisaab,
  onOpenHisaab,
}: {
  entries: Entry[];
  people: Person[];
  hisaabs: Hisaab[];
  members: HisaabMember[];
  currentPersonId: string;
  onAddPerson: (person: Person) => Promise<void>;
  onAddHisaab: (hisaab: Hisaab, members: HisaabMember[]) => void;
  onOpenHisaab: (hisaabId: string) => void;
}) {
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "?";

  const [name, setName] = useState("");
  const [kind, setKind] = useState<HisaabKind>("trip");
  const [cast, setCast] = useState<Set<string>>(() => new Set([currentPersonId]));
  const [newName, setNewName] = useState("");
  // A newly-added person's insert may still be in flight when the hisaab is
  // created; await it first so the membership row's foreign key doesn't race
  // ahead of the person row it points at.
  const pendingPeople = useRef<Promise<void>[]>([]);

  // Your standing within a group: sum of your pairwise nets among its expenses.
  function myNet(hisaabId: string): number {
    const pairs = groupBalances(entries, hisaabId);
    return people.reduce(
      (t, p) => (p.id === currentPersonId ? t : t + netBetween(pairs, currentPersonId, p.id)),
      0,
    );
  }

  function standing(net: number): string {
    if (net === 0) return "settled";
    return net > 0 ? `you owe ${inr(net)}` : `you're owed ${inr(-net)}`;
  }

  function toggleCast(id: string) {
    setCast((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addPerson() {
    const trimmed = newName.trim();
    if (trimmed === "") return;
    const person: Person = {
      id: crypto.randomUUID(),
      name: trimmed,
      createdAt: new Date().toISOString(),
    };
    pendingPeople.current.push(onAddPerson(person));
    setCast((prev) => new Set(prev).add(person.id));
    setNewName("");
  }

  async function create() {
    const trimmed = name.trim();
    if (trimmed === "" || cast.size === 0) return;
    await Promise.all(pendingPeople.current);
    pendingPeople.current = [];
    const id = crypto.randomUUID();
    const hisaab: Hisaab = {
      id,
      name: trimmed,
      kind,
      deity: hisaabs.length % 2 === 0 ? "ganesh" : "lakshmi", // alternate, sticky
      status: "open",
      createdAt: new Date().toISOString(),
    };
    const newMembers: HisaabMember[] = [...cast].map((personId) => ({
      hisaabId: id,
      personId,
      onRoster: true,
    }));
    onAddHisaab(hisaab, newMembers);
    setName("");
    setCast(new Set([currentPersonId]));
    onOpenHisaab(id);
  }

  return (
    <main className="sheet">
      <div className="spacer-1" />
      <div className="deity">{deityLine.lakshmi}</div>
      <div className="title-row">
        <span className="title">Hisaabs</span>
      </div>
      <div className="spacer-1" />

      {hisaabs.map((h) => (
        <button
          key={h.id}
          type="button"
          className="entry group-row"
          onClick={() => onOpenHisaab(h.id)}
          aria-label={`Open ${h.name}`}
        >
          <span className="label">
            {h.name} <span className="group-kind">· {h.kind}</span>
          </span>
          <span className="group-standing">{standing(myNet(h.id))}</span>
        </button>
      ))}

      <div className="spacer-1" />
      <div className="title-row">
        <span className="title">New hisaab</span>
      </div>

      {/* Name it. */}
      <div className="entry open-line">
        <input
          className="open-input" autoComplete="off" data-1p-ignore data-lpignore="true"
          value={name}
          spellCheck={false}
          placeholder="Name a hisaab"
          aria-label="Hisaab name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              create();
            }
          }}
        />
      </div>

      {/* Rolling or trip. */}
      <div className="cast-strip">
        {(["rolling", "trip"] as HisaabKind[]).map((k) => (
          <button
            key={k}
            type="button"
            className={k === kind ? "cast-name" : "cast-name off"}
            onClick={() => setKind(k)}
          >
            {k}
          </button>
        ))}
      </div>

      {/* Who's in it. Tap to toggle; add a new name on the right. */}
      <div className="cast-strip cast-wrap">
        {people.map((p) => (
          <button
            key={p.id}
            type="button"
            className={cast.has(p.id) ? "cast-name" : "cast-name off"}
            onClick={() => toggleCast(p.id)}
          >
            {p.id === currentPersonId ? "You" : p.name}
          </button>
        ))}
      </div>
      <div className="entry open-line add-person-row">
        <input
          className="open-input" autoComplete="off" data-1p-ignore data-lpignore="true"
          value={newName}
          spellCheck={false}
          placeholder="add a name"
          aria-label="Add a person"
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addPerson();
            }
          }}
        />
      </div>

      <div className="spacer-2" />
    </main>
  );
}
