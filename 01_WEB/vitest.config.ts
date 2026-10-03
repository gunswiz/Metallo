import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    server: { deps: { external: [/criar-contas-previa-1b\.mjs$/] } },
    environment: "jsdom",
    include: process.env.METALLO_TEST_1B_AUTH === "1" ? ["10_TESTES/colaborador-auth-real.integration.tsx"] : ["**/*.test.ts", "**/*.test.tsx"],
    setupFiles: ["./10_TESTES/setup.ts"],
  },
});
