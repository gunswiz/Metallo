import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".next-local-preview/**",
    ".next-gestao-preview/**",
    ".next-4c-preview/**",
    ".vinext/**",
    ".wrangler/**",
    "coverage/**",
    "dist/**",
    "next-env.d.ts",
  ]),
]);
