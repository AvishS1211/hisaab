"use client";

import { useEffect, useState } from "react";
import { fetchGuestData } from "../../../../src/lib/db";
import { buildGuestView, type GuestView } from "../../../../src/lib/guestView";
import { GuestPage } from "../../../../src/components/GuestPage";
import { deityLine } from "../../../../src/lib/deity";
import type { Deity } from "../../../../src/lib/types";

// The view link (CLAUDE.md §6, §7): read-only, forever, one person's page of
// one hisaab. No identity, no navigation, no write flow — this route doesn't
// touch the Book at all. Whoever holds this URL can read it; nothing else.
export default function ViewPage({
  params,
}: {
  params: Promise<{ hisaabId: string; personId: string }>;
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "not-found" }
    | { status: "ready"; view: GuestView; deity: Deity }
  >({ status: "loading" });

  useEffect(() => {
    let active = true;
    params.then(({ hisaabId, personId }) => {
      fetchGuestData(hisaabId, personId)
        .then((snap) => {
          if (!active) return;
          if (!snap.hisaab || !snap.person) {
            setState({ status: "not-found" });
            return;
          }
          const view = buildGuestView(snap.entries, snap.people, snap.hisaab, personId);
          setState({ status: "ready", view, deity: snap.hisaab.deity });
        })
        .catch(() => {
          if (active) setState({ status: "not-found" });
        });
    });
    return () => {
      active = false;
    };
  }, [params]);

  if (state.status === "loading") {
    return (
      <main className="sheet">
        <div className="spacer-1" />
        <div className="deity">{deityLine.ganesh}</div>
      </main>
    );
  }
  if (state.status === "not-found") {
    return (
      <main className="sheet">
        <div className="spacer-1" />
        <div className="deity">{deityLine.ganesh}</div>
        <div className="title-row">
          <span className="title">Link not found</span>
        </div>
        <div className="spacer-1" />
        <div className="entry">
          <span className="label empty-note">This page doesn't exist, or the link is wrong.</span>
        </div>
      </main>
    );
  }
  return <GuestPage view={state.view} deity={state.deity} />;
}
