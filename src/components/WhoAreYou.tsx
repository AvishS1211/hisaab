"use client";

import { useState } from "react";
import type { Person } from "../lib/types";
import { deityLine } from "../lib/deity";

// The whole of signing in: tap your name. If you're not on the page yet, write
// it. No email, no password, no OTP. (CLAUDE.md §2.)
export function WhoAreYou({
  people,
  onPick,
  onAdd,
}: {
  people: Person[];
  onPick: (personId: string) => void;
  onAdd: (name: string) => void;
}) {
  const [name, setName] = useState("");

  function add() {
    const trimmed = name.trim();
    if (trimmed === "") return;
    onAdd(trimmed);
    setName("");
  }

  return (
    <main className="sheet">
      <div className="spacer-1" />
      <div className="deity">{deityLine.ganesh}</div>
      <div className="title-row">
        <span className="title">Who are you?</span>
      </div>
      <div className="spacer-1" />

      {people.map((p) => (
        <button
          key={p.id}
          type="button"
          className="entry who-choice"
          onClick={() => onPick(p.id)}
        >
          <span className="label">{p.name}</span>
        </button>
      ))}

      <div className="spacer-1" />
      <div className="entry open-line">
        <input
          className="open-input" autoComplete="off" data-1p-ignore data-lpignore="true"
          value={name}
          spellCheck={false}
          placeholder="or write your name"
          aria-label="Your name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
      </div>

      <div className="spacer-2" />
    </main>
  );
}
