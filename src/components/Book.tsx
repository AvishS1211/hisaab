"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Entry, Hisaab, HisaabMember, Person } from "../lib/types";
import { getIdentity, setIdentity } from "../lib/identity";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  fetchAll,
  insertEntries,
  insertPerson,
  insertHisaab,
  insertMember,
  subscribe,
} from "../lib/db";
import { enqueue, flushQueue, pendingCount } from "../lib/offlineQueue";
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
//
// Identity is scoped, not global (CLAUDE.md §6). There is no directory of every
// person who has ever used the app: a brand-new device can only write its own
// name, and joining a specific hisaab happens through that hisaab's join link,
// which shows only that hisaab's roster. Once signed in, this device only ever
// sees hisaabs (and the people in them) it actually belongs to.

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
  joinHisaabId,
}: {
  seed: {
    entries: Entry[];
    people: Person[];
    hisaabs: Hisaab[];
    members: HisaabMember[];
  };
  /** Present when this device opened a hisaab's join link (CLAUDE.md §6). */
  joinHisaabId?: string;
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

  // Supabase errors are plain objects ({message, details, hint, code}) that
  // console.error prints as an opaque "[object Object]" in some consoles —
  // spell out the fields so failures are actually diagnosable.
  function logDbError(context: string, err: unknown) {
    const e = err as { message?: string; details?: string; hint?: string; code?: string } | null;
    console.error(
      `Hisaab: ${context} — code=${e?.code} message=${e?.message} details=${e?.details} hint=${e?.hint}`,
    );
  }

  // How many writes are sitting in IndexedDB waiting to reach Supabase (§9:
  // offline queue, flushed on reconnect — trivial because writes are inserts).
  const [pending, setPending] = useState(0);
  const refreshPending = () => {
    pendingCount().then(setPending);
  };
  useEffect(() => {
    refreshPending();
  }, []);

  // ── actions: optimistic local update, then persist (append-only). A failed
  // insert (offline, most likely) is queued rather than lost — it'll land on
  // the next flush, in the same order it was written. ──
  function addEntries(newEntries: Entry[]) {
    setEntries((prev) => mergeById(prev, newEntries));
    insertEntries(newEntries).catch(async (err) => {
      logDbError("insert entries failed", err);
      await enqueue({ kind: "entries", entries: newEntries });
      refreshPending();
    });
  }
  // Returns once the insert settles, so callers that immediately reference
  // this person in another row (a hisaab_members insert, say) can await it
  // first — otherwise the dependent insert can reach the DB before this row
  // does and trip the foreign key.
  async function addPerson(person: Person): Promise<void> {
    setPeople((prev) => mergeById(prev, [person]));
    await insertPerson(person).catch(async (err) => {
      logDbError("insert person failed", err);
      await enqueue({ kind: "person", person });
      refreshPending();
    });
  }
  function addHisaab(hisaab: Hisaab, newMembers: HisaabMember[]) {
    setHisaabs((prev) => mergeById(prev, [hisaab]));
    setMembers((prev) => mergeMembers(prev, newMembers));
    insertHisaab(hisaab, newMembers).catch(async (err) => {
      logDbError("insert hisaab failed", err);
      await enqueue({ kind: "hisaab", hisaab, members: newMembers });
      refreshPending();
    });
  }
  function addMember(member: HisaabMember) {
    setMembers((prev) => mergeMembers(prev, [member]));
    insertMember(member).catch(async (err) => {
      logDbError("insert member failed", err);
      await enqueue({ kind: "member", member });
      refreshPending();
    });
  }

  // Flush the queue on load and whenever the browser regains connectivity.
  // Only when Supabase is actually configured — otherwise every insert no-ops
  // and would silently drain a queue that's waiting for a backend to exist.
  useEffect(() => {
    if (!configured) return;
    function flush() {
      flushQueue({
        onEntries: insertEntries,
        onPerson: insertPerson,
        onHisaab: insertHisaab,
        onMember: insertMember,
      }).finally(refreshPending);
    }
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [configured]);

  // ── identity ──
  const [me, setMe] = useState<string | null | undefined>(undefined);
  useEffect(() => setMe(getIdentity()), []);

  // Scope: what this device (as `me`) is actually allowed to see. Derived every
  // render from membership — not stored, so leaving a hisaab (later) shrinks
  // this for free, same as everything else in the app.
  const myHisaabIds = useMemo(
    () => new Set(members.filter((m) => m.personId === me).map((m) => m.hisaabId)),
    [members, me],
  );
  const myHisaabs = useMemo(() => hisaabs.filter((h) => myHisaabIds.has(h.id)), [hisaabs, myHisaabIds]);
  const myPeople = useMemo(() => {
    const ids = new Set(members.filter((m) => myHisaabIds.has(m.hisaabId)).map((m) => m.personId));
    if (typeof me === "string") ids.add(me);
    return people.filter((p) => ids.has(p.id));
  }, [people, members, myHisaabIds, me]);

  // Brand-new device, no hisaab context: you can only write your own name —
  // there is no directory of other people to browse. (CLAUDE.md §2, §6.)
  function bootstrapIdentity(name: string) {
    const person: Person = { id: crypto.randomUUID(), name, createdAt: new Date().toISOString() };
    addPerson(person);
    setIdentity(person.id);
    setMe(person.id);
    setView({ name: "groups" }); // nothing on Accounts yet — go create or join a hisaab
  }
  // Already signed in on this device, opening a hisaab's join link: no need to
  // ask who you are again — just make sure you're on that roster and open it.
  // `autoJoined` also guards joinAsExisting/joinAsNew below: they handle
  // membership themselves, and must mark this done so the effect doesn't fire
  // a second, colliding insert the instant `me` changes to their new value.
  const autoJoined = useRef(false);
  useEffect(() => {
    if (!ready || typeof me !== "string" || !joinHisaabId || autoJoined.current) return;
    autoJoined.current = true;
    const already = members.some((m) => m.hisaabId === joinHisaabId && m.personId === me);
    if (!already) addMember({ hisaabId: joinHisaabId, personId: me, onRoster: true });
    setView({ name: "hisaab", id: joinHisaabId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, me, joinHisaabId]);

  // Arriving via a join link, picking your name off that hisaab's own roster.
  function joinAsExisting(personId: string, hisaabId: string) {
    autoJoined.current = true; // already a member — the effect above must not also fire
    setIdentity(personId);
    setMe(personId);
    setView({ name: "hisaab", id: hisaabId });
  }
  // Arriving via a join link as someone not yet on that roster (a new guest).
  async function joinAsNew(name: string, hisaabId: string) {
    autoJoined.current = true; // membership handled right here — the effect above must not repeat it
    const person: Person = { id: crypto.randomUUID(), name, createdAt: new Date().toISOString() };
    await addPerson(person); // must land before the membership row that references it
    addMember({ hisaabId, personId: person.id, onRoster: true });
    setIdentity(person.id);
    setMe(person.id);
    setView({ name: "hisaab", id: hisaabId });
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
          people={myPeople}
          hisaabs={myHisaabs}
          members={members}
          currentPersonId={meId}
          onOpenHisaab={openHisaab}
        />
      );
    }
    if (v.name === "groups") {
      return (
        <GroupsPage
          entries={entries}
          people={myPeople}
          hisaabs={myHisaabs}
          members={members}
          currentPersonId={meId}
          onAddPerson={addPerson}
          onAddHisaab={addHisaab}
          onOpenHisaab={openHisaab}
        />
      );
    }
    // Gate: only render a ledger you actually belong to.
    if (!myHisaabIds.has(v.id)) return null;
    const h = myHisaabs.find((x) => x.id === v.id);
    if (!h) return null;
    const roster = members
      .filter((m) => m.hisaabId === v.id && m.onRoster)
      .map((m) => m.personId);
    return (
      <HisaabPage
        hisaab={h}
        entries={entries}
        onAddEntries={addEntries}
        people={myPeople}
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

  const knownMe = typeof me === "string" && people.some((p) => p.id === me);

  if (!knownMe) {
    if (joinHisaabId) {
      const hisaab = hisaabs.find((h) => h.id === joinHisaabId);
      if (!hisaab) {
        return (
          <div className="book">
            <main className="sheet">
              <div className="spacer-1" />
              <div className="deity">{deityLine.ganesh}</div>
              <div className="title-row">
                <span className="title">Link not found</span>
              </div>
              <div className="spacer-1" />
              <div className="entry">
                <span className="label empty-note">
                  This hisaab doesn't exist, or the link is wrong.
                </span>
              </div>
            </main>
          </div>
        );
      }
      const rosterIds = members
        .filter((m) => m.hisaabId === joinHisaabId && m.onRoster)
        .map((m) => m.personId);
      const rosterPeople = people.filter((p) => rosterIds.includes(p.id));
      return (
        <div className="book">
          <WhoAreYou
            people={rosterPeople}
            subtitle={`Joining ${hisaab.name}`}
            onPick={(id) => joinAsExisting(id, joinHisaabId)}
            onAdd={(name) => joinAsNew(name, joinHisaabId)}
          />
        </div>
      );
    }
    // Bootstrap: no join context. Only your own name — no directory to browse.
    return (
      <div className="book">
        <WhoAreYou people={[]} onPick={() => {}} onAdd={bootstrapIdentity} />
      </div>
    );
  }

  const meId = me as string;

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
        {pending > 0 && <span className="pending-note"> · {pending} to sync</span>}
      </div>
    </div>
  );
}
