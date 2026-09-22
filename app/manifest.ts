import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Inventario de Equipos — Grupo Comidas",
    short_name: "Inventario",
    description:
      "Sistema de gestión de inventario y solicitudes de equipos para Grupo Comidas.",
    id: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f4f5",
    theme_color: "#E10600",
    orientation: "any",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}