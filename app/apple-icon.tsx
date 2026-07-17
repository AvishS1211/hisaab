import { ImageResponse } from "next/og";

// Same notebook-cover icon, under the filename convention iOS looks for when
// someone installs via "Add to Home Screen" (§9 PWA). No deity here either —
// see icon.tsx.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
            width: 135,
            height: 146,
            backgroundColor: "#f7f1e3",
            display: "flex",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 14,
              top: 0,
              bottom: 0,
              width: 2,
              backgroundColor: "#d38b83",
            }}
          />
          {[36, 65, 93, 121].map((top) => (
            <div
              key={top}
              style={{
                position: "absolute",
                left: 22,
                right: 10,
                top,
                height: 2,
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
