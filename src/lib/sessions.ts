import type { Entry } from "./types";
import { liveEntries } from "./balance";

// Sessions (CLAUDE.md's Sessions section): a session is a divider entry that
// sets the default cast for lines written after it — "Dev's not here" means
// every line from there on excludes Dev until another divider changes it
// again. No session table: the entries carry the truth, so the "current
// default" is just whatever the most recent live session entry says.

/**
 * The default cast for the next line written in this hisaab: the roster,
 * unless a live session divider has set a narrower (or different) default
 * more recently. A struck session is ignored, same as a struck expense drops
 * out of the balance — strike it to undo "Dev's not here."
 */
export function currentDefaultCast(
  entries: Entry[],
  hisaabId: string,
  roster: string[],
): string[] {
  const sessions = liveEntries(entries)
    .filter((e) => e.kind === "session" && e.hisaabId === hisaabId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const last = sessions[sessions.length - 1];
  if (!last?.splitIds) return [...roster];
  // Only people still actually on the roster — a session doesn't resurrect
  // someone who's since left, and can't default-in someone who joined after.
  const rosterSet = new Set(roster);
  return last.splitIds.filter((id) => rosterSet.has(id));
}
