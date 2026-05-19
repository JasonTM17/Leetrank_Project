import type { MetadataRoute } from "next";

// Next 16 metadata API: this single export becomes /manifest.webmanifest
// at runtime. Pairs with src/app/icon.tsx for the install icon and with
// the <head> theme-color set by src/app/layout.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LeetRank",
    short_name: "LeetRank",
    description: "Master algorithms. Ace interviews.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0d10",
    theme_color: "#4f46e5",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
