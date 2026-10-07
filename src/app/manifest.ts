import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hub ศูนย์กลางการสื่อสาร",
    short_name: "Hub",
    description: "ศูนย์กลางการสื่อสารองค์กร ส.เจริญชัย รีไซเคิล",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#dbe9ee",
    theme_color: "#0b7f72",
    lang: "th",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
