import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Podium",
    short_name: "Podium",
    description: "Daily recruitment allocation, pipeline, and performance tracking.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F6F6F8",
    theme_color: "#068AD3",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Log today", short_name: "Log", url: "/dashboard", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Team dashboard", short_name: "Team", url: "/manager", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
