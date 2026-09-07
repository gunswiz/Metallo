import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Metallo — Gestão Industrial",
    short_name: "Metallo",
    description: "Administração de materiais, equipamentos, equipes e EPIs.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#041019",
    theme_color: "#071520",
    orientation: "any",
    lang: "pt-BR",
    icons: [
      { src: "/metallo-app-icon.png", sizes: "1024x1024", type: "image/png", purpose: "any" },
      { src: "/metallo-app-icon.png", sizes: "1024x1024", type: "image/png", purpose: "maskable" },
    ],
  };
}
