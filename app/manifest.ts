import type { MetadataRoute } from "next";

// The PWA manifest (§9). Writers install; readers get a view link and never
// need this at all (§1).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hisaab",
    short_name: "Hisaab",
    description: "A shared expense ledger, kept like a bahi-khata.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f1e3",
    theme_color: "#f7f1e3",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
