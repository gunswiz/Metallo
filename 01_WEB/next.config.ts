import type { NextConfig } from "next";
import { colaboradorEnvironment } from "./09_CONFIGURACOES/colaborador-laboratorio";

colaboradorEnvironment(process.env); // Falhar no início, sem fallback visual/remoto.

const nextConfig: NextConfig = {
  distDir: process.env.METALLO_4C_TELEMETRY === "1" && process.env.METALLO_LOCAL_PREVIEW === "1" ? ".next-4c-preview" : process.env.METALLO_GESTAO_VISUAL_PREVIEW === "1" ? ".next-gestao-preview" : process.env.METALLO_LOCAL_PREVIEW === "1" ? ".next-local-preview" : ".next",
  devIndicators: process.env.METALLO_LOCAL_PREVIEW === "1" ? false : undefined,
  reactStrictMode: true,
  transpilePackages: ["@metallo/core", "@metallo/types", "@metallo/validation"],
  poweredByHeader: false,
};

export default nextConfig;
