import Dexie, { type Table } from "dexie";
import type { Entry, Hisaab, HisaabMember, Person } from "./types";

// The offline write queue (CLAUDE.md §9). Trivial *because* the log is
// append-only (§10): a queued write is just an insert that hasn't landed yet.
// No merge, no conflict resolution — flushing twice is safe by the same logic
// that makes offline duplicate entries safe (strike one, don't dedup).

export type QueuedAction =
  | { kind: "entries"; entries: Entry[] }
  | { kind: "person"; person: Person }
  | { kind: "hisaab"; hisaab: Hisaab; members: HisaabMember[] }
  | { kind: "member"; member: HisaabMember };

interface QueueRow {
  id?: number;
  action: QueuedAction;
  queuedAt: string;
}

class OfflineQueueDB extends Dexie {
  pending!: Table<QueueRow, number>;
  constructor() {
    super("hisaab-offline-queue");
    this.version(1).stores({ pending: "++id" });
  }
}

// Dexie touches indexedDB at construction time, which doesn't exist during
// server rendering — only build the db in the browser.
const db = typeof window !== "undefined" ? new OfflineQueueDB() : null;

export async function enqueue(action: QueuedAction): Promise<void> {
  if (!db) return;
  await db.pending.add({ action, queuedAt: new Date().toISOString() });
}

export async function pendingCount(): Promise<number> {
  if (!db) return 0;
  return db.pending.count();
}

export interface FlushHandlers {
  onEntries: (entries: Entry[]) => Promise<void>;
  onPerson: (person: Person) => Promise<void>;
  onHisaab: (hisaab: Hisaab, members: HisaabMember[]) => Promise<void>;
  onMember: (member: HisaabMember) => Promise<void>;
}

/**
 * Replays queued writes in the order they were made, removing each as it
 * lands. Stops at the first failure (still offline, or a genuine error) so
 * later writes never jump ahead of earlier ones — a strike must still land
 * after the line it targets exists, e.g.
 */
export async function flushQueue(handlers: FlushHandlers): Promise<void> {
  if (!db) return;
  const rows = await db.pending.orderBy("id").toArray();
  for (const row of rows) {
    try {
      const a = row.action;
      if (a.kind === "entries") await handlers.onEntries(a.entries);
      else if (a.kind === "person") await handlers.onPerson(a.person);
      else if (a.kind === "hisaab") await handlers.onHisaab(a.hisaab, a.members);
      else if (a.kind === "member") await handlers.onMember(a.member);
      await db.pending.delete(row.id!);
    } catch {
      break;
    }
  }
}
