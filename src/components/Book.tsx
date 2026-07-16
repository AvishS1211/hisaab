"use client";

import { useEffect, useRef, useState } from "react";
import type { Entry, Hisaab, HisaabMember, Person } from "../lib/types";
import { getIdentity, setIdentity, clearIdentity } from "../lib/identity";
import { isSupabaseConfigured } from "../lib/supabase";
import { fetchAll, insertEntries, insertPerson, insertHisaab, subscribe } from "../lib/db";
import { deityLine } from "../lib/deity";
import { PersonPage } from "./PersonPage";
import { GroupsPage } from "./GroupsPage";
import { HisaabPage } from "./HisaabPage";
import { WhoAreYou } from "./WhoAreYou";

// The book. It owns all state and turns between three pages:
//   profile (Accounts) ⇄ groups (Hisaabs) → a hisaab ledger
// When Supabase is configured the log lives there — the book loads it, appends
// to it, and merges realtime inserts so flatmates sync live. Otherwise it runs
// on the in-memory seed.

type View =
  | { name: "profile" }
  | { name: "groups" }
  | { name: "hisaab"; id: string };

// Append rows we haven't seen (dedupe by id — a locally-inserted row echoes back
// over realtime, and must not double up).
const mergeById = <T extends { id: string }>(prev: T[], incoming: T[]): T[] => {
  const seen = new Set(prev.map((x) => x.id));
  const add = incoming.filter((x) => !seen.has(x.id));
  return add.length ? [...prev, ...add] : prev;
};
const memberKey = (m: HisaabMember) => `${m.hisaabId}:${m.personId}`;
const mergeMembers = (prev: HisaabMember[], incoming: HisaabMember[]): HisaabMember[] => {
  const seen = new Set(prev.map(memberKey));
  const add = incoming.filter((m) => !seen.has(memberKey(m)));
  return add.length ? [...prev, ...add] : prev;
};

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
  const configured = isSupabaseConfigured;
  const [entries, setEntries] = useState<Entry[]>(configured ? [] : seed.entries);
  const [people, setPeople] = useState<Person[]>(configured ? [] : seed.people);
  const [hisaabs, setHisaabs] = useState<Hisaab[]>(configured ? [] : seed.hisaabs);
  const [members, setMembers] = useState<HisaabMember[]>(configured ? [] : seed.members);
  const [ready, setReady] = useState(!configured);

  // Load the log and subscribe to live inserts.
  useEffect(() => {
    if (!configured) return;
    let active = true;
    fetchAll()
      .then((snap) => {
        if (!active) return;
        setPeople(snap.people);
        setHisaabs(snap.hisaabs);
        setMembers(snap.members);
        setEntries(snap.entries);
        setReady(true);
      })
      .catch((err) => {
        console.error("Hisaab: failed to load from Supabase", err);
        setReady(true);
      });
    const unsub = subscribe({
      onPerson: (p) => setPeople((prev) => mergeById(prev, [p])),
      onHisaab: (h) => setHisaabs((prev) => mergeById(prev, [h])),
      onMember: (m) => setMembers((prev) => mergeMembers(prev, [m])),
      onEntry: (e) => setEntries((prev) => mergeById(prev, [e])),
    });
    return () => {
      active = false;
      unsub();
    };
  }, [configured]);

  // ── actions: optimistic local update, then persist (append-only) ──
  function addEntries(newEntries: Entry[]) {
    setEntries((prev) => mergeById(prev, newEntries));
    insertEntries(newEntries).catch((err) => console.error("Hisaab: insert entries failed", err));
  }
  function addPerson(person: Person) {
    setPeople((prev) => mergeById(prev, [person]));
    insertPerson(person).catch((err) => console.error("Hisaab: insert person failed", err));
  }
  function addHisaab(hisaab: Hisaab, newMembers: HisaabMember[]) {
    setHisaabs((prev) => mergeById(prev, [hisaab]));
    setMembers((prev) => mergeMembers(prev, newMembers));
    insertHisaab(hisaab, newMembers).catch((err) => console.error("Hisaab: insert hisaab failed", err));
  }

  // ── identity ──
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
    addPerson(person);
    pickIdentity(person.id);
  }
  function switchIdentity() {
    clearIdentity();
    setMe(null);
    setView({ name: "profile" });
  }

  // ── navigation ──
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
      if (view.name === "profile") navigate({ name: "groups" }, "fwd");
    } else {
      if (view.name === "groups") navigate({ name: "profile" }, "back");
      else if (view.name === "hisaab") navigate({ name: "groups" }, "back");
    }
  }

  function renderView(v: View, meId: string) {
    if (v.name === "profile") {
      return (
        <PersonPage
          entries={entries}
          onAddEntries={addEntries}
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
          onAddPerson={addPerson}
          onAddHisaab={addHisaab}
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
        onAddEntries={addEntries}
        people={people}
        roster={roster}
        currentPersonId={meId}
      />
    );
  }

  // Still reading storage or loading the log: a quiet paper sheet.
  if (me === undefined || !ready) {
    return (
      <div className="book">
        <main className="sheet">
          <div className="spacer-1" />
          <div className="deity">{deityLine.ganesh}</div>
        </main>
      </div>
    );
  }
  // Not signed in on this device yet (or signed in as someone the log doesn't know).
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
