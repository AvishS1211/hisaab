import type { GuestLine, GuestView } from "../lib/guestView";
import { deityLine } from "../lib/deity";
import { inr, netPhrase } from "../lib/format";

// The view link's render (CLAUDE.md §6, §7): read-only, one person, one
// hisaab. Not a stripped hisaab page — this never shows another person's line,
// never the full roster, never the write flow. Lead with the number, then the
// expense and what was actually paid (§1) — same rule as the person page, one
// level down to a single hisaab instead of everything.
function GuestLineRow({ line }: { line: GuestLine }) {
  return (
    <>
      <div className="entry guest-line">
        <span className="label">{line.label}</span>
        <span className="amount">{inr(line.share)}</span>
      </div>
      <div className="break guest-working">
        <span className="label">
          {line.isPayer ? `you paid ${inr(line.amount)}` : `${line.payerName} paid ${inr(line.amount)}`}
        </span>
        {!line.isPayer && (
          <span className="break-amt">
            <span className="dir">you owe {line.payerName}</span>
          </span>
        )}
      </div>
    </>
  );
}

export function GuestPage({ view, deity }: { view: GuestView; deity: "ganesh" | "lakshmi" }) {
  return (
    <main className="sheet">
      <div className="spacer-1" />
      <div className="deity">{deityLine[deity]}</div>
      <div className="title-row">
        <span className="title">{view.hisaabName}</span>
      </div>
      <div className="me-row">
        <span className="me-name">{view.personName}</span>
        <span className="me-net">{netPhrase(view.net)}</span>
      </div>
      <div className="spacer-1" />

      {view.lines.length === 0 ? (
        <div className="entry">
          <span className="label empty-note">Nothing here yet.</span>
        </div>
      ) : (
        view.lines.map((line, i) => <GuestLineRow key={i} line={line} />)
      )}

      <div className="spacer-2" />
    </main>
  );
}
