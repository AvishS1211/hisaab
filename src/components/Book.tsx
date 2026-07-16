"use client";

import { useEffect, useRef, useState } from "react";
import type { Entry, Hisaab, HisaabMember, Person } from "../lib/types";
import { getIdentity, setIdentity, clearIdentity } from "../lib/identity";
import { deityLine } from "../lib/deity";
import { PersonPage } from "./PersonPage";
import { GroupsPage } from "./GroupsPage";
import { HisaabPage } from "./HisaabPage";
import { WhoAreYou } from "./WhoAreYou";

// The book. It owns all state and turns between three pages:
//   profile (Accounts) ⇄ groups (Hisaabs) → a hisaab ledger
// Swipe right-to-left to go deeper, left-to-right to come back — each with a
// page turn. Because the book holds the log, writes/strikes/settlements persist
// as you move between pages.

type View =
  | { name: "profile" }
  | { name: "groups" }
  | { name: "hisaab"; id: string };

export function Book({
  seed,
}: {
  seed: {
    entries: Entry[];
    people: Person[];
    hisaabs: Hisaab[];
    members: HisaabMember[];
  };
}) {
  const [entries, setEntries] = useState<Entry[]>(seed.entries);
  const [people, setPeople] = useState<Person[]>(seed.people);
  const [hisaabs, setHisaabs] = useState<Hisaab[]>(seed.hisaabs);
  const [members, setMembers] = useState<HisaabMember[]>(seed.members);

  // Who this device is. `undefined` = still reading storage (first paint),
  // `null` = not chosen yet (show "Who are you?"), else the person id.
  const [me, setMe] = useState<string | null | undefined>(undefined);
  useEffect(() => setMe(getIdentity()), []);

  function pickIdentity(personId: string) {
    setIdentity(personId);
    setMe(personId);
  }
  function addAndPickIdentity(name: string) {
    const person: Person = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
    };
    setPeople((prev) => [...prev, person]);
    pickIdentity(person.id);
  }
  function switchIdentity() {
    clearIdentity();
    setMe(null);
    setView({ name: "profile" });
  }

  const [view, setView] = useState<View>({ name: "profile" });
  const [anim, setAnim] = useState<{ prev: View; dir: "fwd" | "back" } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  function navigate(next: View, dir: "fwd" | "back") {
    if (anim) return;
    setAnim({ prev: view, dir });
    setView(next);
  }
  const openHisaab = (id: string) => navigate({ name: "hisaab", id }, "fwd");

  function onPointerDown(e: React.PointerEvent) {
    start.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e: React.PointerEvent) {
    const s = start.current;
    start.current = null;
    if (!s || anim) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return; // not a horizontal swipe
    if (dx < 0) {
      // right-to-left → go deeper
      if (view.name === "profile") navigate({ name: "groups" }, "fwd");
    } else {
      // left-to-right → come back
      if (view.name === "groups") navigate({ name: "profile" }, "back");
      else if (view.name === "hisaab") navigate({ name: "groups" }, "back");
    }
  }

  function renderView(v: View, meId: string) {
    if (v.name === "profile") {
      return (
        <PersonPage
          entries={entries}
          setEntries={setEntries}
          people={people}
          hisaabs={hisaabs}
          members={members}
          currentPersonId={meId}
          onOpenHisaab={openHisaab}
          onSwitchIdentity={switchIdentity}
        />
      );
    }
    if (v.name === "groups") {
      return (
        <GroupsPage
          entries={entries}
          people={people}
          hisaabs={hisaabs}
          members={members}
          currentPersonId={meId}
          setPeople={setPeople}
          setHisaabs={setHisaabs}
          setMembers={setMembers}
          onOpenHisaab={openHisaab}
        />
      );
    }
    const h = hisaabs.find((x) => x.id === v.id);
    if (!h) return null;
    const roster = members
      .filter((m) => m.hisaabId === v.id && m.onRoster)
      .map((m) => m.personId);
    return (
      <HisaabPage
        hisaab={h}
        entries={entries}
        setEntries={setEntries}
        people={people}
        roster={roster}
        currentPersonId={meId}
      />
    );
  }

  // First paint / before storage is read: a quiet paper sheet.
  if (me === undefined) {
    return (
      <div className="book">
        <main className="sheet">
          <div className="spacer-1" />
          <div className="deity">{deityLine.ganesh}</div>
        </main>
      </div>
    );
  }
  // Not signed in on this device yet.
  if (me === null || !people.some((p) => p.id === me)) {
    return (
      <div className="book">
        <WhoAreYou people={people} onPick={pickIdentity} onAdd={addAndPickIdentity} />
      </div>
    );
  }
  const meId: string = me;

  const hint =
    view.name === "profile"
      ? "swipe left for hisaabs ›"
      : view.name === "groups"
        ? "‹ swipe right for accounts"
        : "‹ swipe right for hisaabs";

  return (
    <div
      className={anim ? "book animating" : "book"}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {anim ? (
        anim.dir === "fwd" ? (
          <>
            <div className="page">{renderView(view, meId)}</div>
            <div className="page turning turn-out" onAnimationEnd={() => setAnim(null)}>
              <div className="face front">{renderView(anim.prev, meId)}</div>
              <div className="face back" />
            </div>
          </>
        ) : (
          <>
            <div className="page">{renderView(anim.prev, meId)}</div>
            <div className="page turning turn-in" onAnimationEnd={() => setAnim(null)}>
              <div className="face front">{renderView(view, meId)}</div>
              <div className="face back" />
            </div>
          </>
        )
      ) : (
        <div className="page-static">{renderView(view, meId)}</div>
      )}

      <div className="swipe-hint" aria-hidden="true">
        {hint}
      </div>
    </div>
  );
}
