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
      { src: "/metallo-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/metallo-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
