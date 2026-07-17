import { describe, it, expect } from "vitest";
import type { Entry } from "./types";
import { currentDefaultCast } from "./sessions";

let seq = 0;
const id = () => `e${++seq}`;
let t = Date.parse("2026-07-15T18:00:00Z");
const at = () => new Date((t += 60_000)).toISOString();

function session(hisaabId: string, label: string, splitIds: string[]): Entry {
  return {
    id: id(),
    hisaabId,
    kind: "session",
    label,
    splitIds,
    authoredBy: "A",
    createdAt: at(),
  };
}
function strike(targetId: string): Entry {
  return {
    id: id(),
    hisaabId: null,
    kind: "strike",
    targetId,
    authoredBy: "A",
    createdAt: at(),
  };
}

const roster = ["A", "B", "C", "D"];

describe("currentDefaultCast", () => {
  it("is the full roster when no session has ever been written", () => {
    expect(currentDefaultCast([], "goa", roster)).toEqual(roster);
  });

  it("narrows to a session's cast once one is written", () => {
    const s = session("goa", "Dev's not here", ["A", "B", "C"]); // D excluded
    expect(currentDefaultCast([s], "goa", roster)).toEqual(["A", "B", "C"]);
  });

  it("the most recent live session wins", () => {
    const s1 = session("goa", "Dev's not here", ["A", "B", "C"]);
    const s2 = session("goa", "Dev's back", roster);
    expect(currentDefaultCast([s1, s2], "goa", roster)).toEqual(roster);
  });

  it("a struck session is ignored — falls back to the one before it, or the roster", () => {
    const s1 = session("goa", "Dev's not here", ["A", "B", "C"]);
    const s2 = session("goa", "Actually B is out too", ["A", "C"]);
    const struck = strike(s2.id);
    expect(currentDefaultCast([s1, s2, struck], "goa", roster)).toEqual(["A", "B", "C"]);
  });

  it("un-striking (a strike on the strike) restores it", () => {
    const s = session("goa", "Dev's not here", ["A", "B", "C"]);
    const s1 = strike(s.id);
    const undo = strike(s1.id);
    expect(currentDefaultCast([s, s1, undo], "goa", roster)).toEqual(["A", "B", "C"]);
  });

  it("ignores sessions from a different hisaab", () => {
    const s = session("ghar", "Dev's not here", ["A", "B", "C"]);
    expect(currentDefaultCast([s], "goa", roster)).toEqual(roster);
  });

  it("drops anyone the session named who has since left the roster", () => {
    const s = session("goa", "Everyone tonight", ["A", "B", "C", "D"]);
    // D left the roster after the session was written.
    expect(currentDefaultCast([s], "goa", ["A", "B", "C"])).toEqual(["A", "B", "C"]);
  });
});
