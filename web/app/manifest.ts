import type { MetadataRoute } from "next";

/** Lets phones install RepSense on the home screen and open it full-screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RepSense: AI calisthenics coach",
    short_name: "RepSense",
    description: "Counts your reps and checks your form in real time, on your device.",
    start_url: "/today",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
