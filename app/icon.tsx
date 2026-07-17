import { ImageResponse } from "next/og";

// The app icon. CLAUDE.md §8: the deity is never the icon, never chrome —
// only text at the top of a page. So this is the *object* instead: a
// cloth-bound notebook cover with ruled cream pages showing, no illustration
// of a person or deity. Abstract, legible small, on-brand.

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#7a2b2b",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 384,
            height: 416,
            backgroundColor: "#f7f1e3",
            display: "flex",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 40,
              top: 0,
              bottom: 0,
              width: 6,
              backgroundColor: "#d38b83",
            }}
          />
          {[104, 184, 264, 344].map((top) => (
            <div
              key={top}
              style={{
                position: "absolute",
                left: 64,
                right: 28,
                top,
                height: 4,
                backgroundColor: "#b4c6d8",
              }}
            />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
