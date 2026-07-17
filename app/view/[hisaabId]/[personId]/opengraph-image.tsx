import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fetchGuestData } from "../../../../src/lib/db";
import { buildGuestView } from "../../../../src/lib/guestView";
import { netPhrase } from "../../../../src/lib/format";

// The view link's og:image: the actual khata page — paper, the number.
// Server-rendered so every share is a free ad (CLAUDE.md §6). Devanagari isn't
// loaded here (Satori needs an explicit font per script), so this renders the
// Latin content only — name, hisaab, the one number — on the paper background.

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({
  params,
}: {
  params: Promise<{ hisaabId: string; personId: string }>;
}) {
  const { hisaabId, personId } = await params;
  // Satori (which renders this) supports ttf/otf/woff — not woff2, so this is
  // a separate, plain-woff copy of Kalam bold, latin-only (fine: og:image text
  // here is always Latin — names, hisaab titles, amounts).
  const kalam = await readFile(join(process.cwd(), "public/fonts/kalam-og.woff"));

  // A malformed id (not a UUID) reaches Postgres as an error, not an empty
  // result — fall back to the generic card rather than a broken image.
  const snap = await fetchGuestData(hisaabId, personId).catch(() => null);
  const view =
    snap?.hisaab && snap.person
      ? buildGuestView(snap.entries, snap.people, snap.hisaab, personId)
      : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#f7f1e3",
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent 0px, transparent 55px, #b4c6d8 55px, #b4c6d8 56px)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 68,
            width: 2,
            backgroundColor: "#d38b83",
          }}
        />
        {view ? (
          <div style={{ display: "flex", flexDirection: "column", paddingLeft: 112, paddingRight: 56 }}>
            <div style={{ fontSize: 30, color: "#918876", letterSpacing: 4, marginBottom: 8 }}>
              {view.hisaabName.toUpperCase()}
            </div>
            <div style={{ display: "flex", fontSize: 72, color: "#2a3348", fontFamily: "Kalam" }}>
              {view.personName}
            </div>
            <div style={{ display: "flex", fontSize: 44, color: "#2a3348", marginTop: 16, fontFamily: "Kalam" }}>
              {netPhrase(view.net)}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 48, color: "#2a3348", fontFamily: "Kalam" }}>
            Hisaab
          </div>
        )}
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Kalam", data: kalam, style: "normal", weight: 700 }],
    },
  );
}
