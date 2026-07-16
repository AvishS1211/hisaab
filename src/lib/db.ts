import { supabase } from "./supabase";
import type { Entry, Hisaab, HisaabMember, Person } from "./types";

// Data access. Everything here is a thin, append-only wrapper over Supabase:
// load the whole log, insert new rows, and subscribe to inserts for live sync.
// The DB is snake_case; these functions map to/from the camelCase domain types.

// ── row → domain ────────────────────────────────────────────────────────────
type Row = Record<string, unknown>;

const toPerson = (r: Row): Person => ({
  id: r.id as string,
  name: r.name as string,
  createdAt: r.created_at as string,
});

const toHisaab = (r: Row): Hisaab => ({
  id: r.id as string,
  name: r.name as string,
  kind: r.kind as Hisaab["kind"],
  deity: r.deity as Hisaab["deity"],
  status: r.status as Hisaab["status"],
  createdAt: r.created_at as string,
});

const toMember = (r: Row): HisaabMember => ({
  hisaabId: r.hisaab_id as string,
  personId: r.person_id as string,
  onRoster: r.on_roster as boolean,
});

const toEntry = (r: Row): Entry => ({
  id: r.id as string,
  hisaabId: (r.hisaab_id as string | null) ?? null,
  kind: r.kind as Entry["kind"],
  label: (r.label as string | null) ?? null,
  amount: (r.amount as number | null) ?? null,
  payerId: (r.payer_id as string | null) ?? null,
  payeeId: (r.payee_id as string | null) ?? null,
  splitIds: (r.split_ids as string[] | null) ?? null,
  targetId: (r.target_id as string | null) ?? null,
  authoredBy: r.authored_by as string,
  createdAt: r.created_at as string,
});

// ── domain → row ────────────────────────────────────────────────────────────
const personRow = (p: Person) => ({ id: p.id, name: p.name, created_at: p.createdAt });

const hisaabRow = (h: Hisaab) => ({
  id: h.id,
  name: h.name,
  kind: h.kind,
  deity: h.deity,
  status: h.status,
  created_at: h.createdAt,
});

const memberRow = (m: HisaabMember) => ({
  hisaab_id: m.hisaabId,
  person_id: m.personId,
  on_roster: m.onRoster,
});

const entryRow = (e: Entry) => ({
  id: e.id,
  hisaab_id: e.hisaabId,
  kind: e.kind,
  label: e.label ?? null,
  amount: e.amount ?? null,
  payer_id: e.payerId ?? null,
  payee_id: e.payeeId ?? null,
  split_ids: e.splitIds ?? null,
  target_id: e.targetId ?? null,
  authored_by: e.authoredBy,
  created_at: e.createdAt,
});

// ── reads ───────────────────────────────────────────────────────────────────
export interface Snapshot {
  people: Person[];
  hisaabs: Hisaab[];
  members: HisaabMember[];
  entries: Entry[];
}

export async function fetchAll(): Promise<Snapshot> {
  if (!supabase) return { people: [], hisaabs: [], members: [], entries: [] };
  const [people, hisaabs, members, entries] = await Promise.all([
    supabase.from("people").select("*").order("created_at"),
    supabase.from("hisaabs").select("*").order("created_at"),
    supabase.from("hisaab_members").select("*"),
    supabase.from("entries").select("*").order("created_at"),
  ]);
  const err = people.error || hisaabs.error || members.error || entries.error;
  if (err) throw err;
  return {
    people: (people.data ?? []).map(toPerson),
    hisaabs: (hisaabs.data ?? []).map(toHisaab),
    members: (members.data ?? []).map(toMember),
    entries: (entries.data ?? []).map(toEntry),
  };
}

// ── writes (append-only) ─────────────────────────────────────────────────────
export async function insertEntries(entries: Entry[]): Promise<void> {
  if (!supabase || entries.length === 0) return;
  const { error } = await supabase.from("entries").insert(entries.map(entryRow));
  if (error) throw error;
}

export async function insertPerson(person: Person): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("people").insert(personRow(person));
  if (error) throw error;
}

export async function insertHisaab(hisaab: Hisaab, members: HisaabMember[]): Promise<void> {
  if (!supabase) return;
  const h = await supabase.from("hisaabs").insert(hisaabRow(hisaab));
  if (h.error) throw h.error;
  if (members.length > 0) {
    const m = await supabase.from("hisaab_members").insert(members.map(memberRow));
    if (m.error) throw m.error;
  }
}

// ── realtime ─────────────────────────────────────────────────────────────────
export interface RealtimeHandlers {
  onPerson: (p: Person) => void;
  onHisaab: (h: Hisaab) => void;
  onMember: (m: HisaabMember) => void;
  onEntry: (e: Entry) => void;
}

/** Subscribe to inserts across all tables. Returns an unsubscribe function. */
export function subscribe(h: RealtimeHandlers): () => void {
  const client = supabase;
  if (!client) return () => {};
  const channel = client
    .channel("hisaab")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "people" }, (p) =>
      h.onPerson(toPerson(p.new)),
    )
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "hisaabs" }, (p) =>
      h.onHisaab(toHisaab(p.new)),
    )
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "hisaab_members" }, (p) =>
      h.onMember(toMember(p.new)),
    )
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "entries" }, (p) =>
      h.onEntry(toEntry(p.new)),
    )
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
