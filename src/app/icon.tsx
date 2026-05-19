import { ImageResponse } from "next/og";

// Next 16 file convention: src/app/icon.tsx becomes both /icon and the
// <link rel="icon"> the browser uses for the tab favicon. We render an
// indigo->violet gradient with "LR" monogram so we don't need a binary
// PNG checked into the repo. ImageResponse caches per-build, so this is
// effectively free at runtime.
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
          background:
            "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)",
          color: "white",
          fontSize: 280,
          fontWeight: 800,
          letterSpacing: "-0.05em",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        LR
      </div>
    ),
    { ...size },
  );
}
