import type { Metadata } from "next";
import { fetchGuestData } from "../../../../src/lib/db";
import { buildGuestView } from "../../../../src/lib/guestView";
import { inr } from "../../../../src/lib/format";

// Third-person, unlike netPhrase (which speaks as "you" for the page itself) —
// this text is read by whoever the link gets forwarded to, not the person it's about.
function thirdPersonNet(net: number): string {
  if (net === 0) return "is settled up";
  return net > 0 ? `owes ${inr(net)}` : `is owed ${inr(-net)}`;
}

// Metadata needs a server component; the page itself stays a client component
// (see page.tsx). Every share is a free ad (§6) — give it a real title too,
// not just the og:image.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ hisaabId: string; personId: string }>;
}): Promise<Metadata> {
  const { hisaabId, personId } = await params;
  try {
    const snap = await fetchGuestData(hisaabId, personId);
    if (!snap.hisaab || !snap.person) {
      return { title: "Hisaab" };
    }
    const view = buildGuestView(snap.entries, snap.people, snap.hisaab, personId);
    return {
      title: `${view.personName} · ${view.hisaabName} — Hisaab`,
      description: `${view.personName} ${thirdPersonNet(view.net)} on ${view.hisaabName}.`,
    };
  } catch {
    // A malformed id (not a UUID, say) reaches Postgres as an error, not an
    // empty result — this is still just "link not found," not a crash.
    return { title: "Hisaab" };
  }
}

export default function ViewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
