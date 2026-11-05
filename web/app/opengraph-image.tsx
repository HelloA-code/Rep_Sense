import { ImageResponse } from "next/og";

export const alt = "RepSense: AI calisthenics coach that runs in your browser";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The preview shown when the link is shared. */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 88,
        color: "#fff",
        background: "radial-gradient(circle at 15% 0%, rgba(255,197,61,0.28), #000 55%)",
      }}
    >
      <div style={{ fontSize: 34, fontWeight: 700, color: "#FFC53D" }}>RepSense</div>
      <div style={{ marginTop: 18, fontSize: 84, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
        Your AI calisthenics coach
      </div>
      <div style={{ marginTop: 28, fontSize: 34, color: "#9a9a9a" }}>
        Counts reps and checks form in your browser. Video never leaves your device.
      </div>
    </div>,
    size,
  );
}
