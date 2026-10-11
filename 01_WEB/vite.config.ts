import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { cdnAdapter } from "@vinext/cloudflare/cache/cdn-adapter";

// Marco 7A: o app precisa abrir em celular antigo (Chrome 87+, ex.: Android 7 sem atualização recente).
// O código é convertido para essa versão; o que falta de função fica em public/compat-antigos.js.
const ALVO_NAVEGADORES = ["chrome87", "edge88", "firefox78", "safari14"];

export default defineConfig({
  build: { target: ALVO_NAVEGADORES },
  plugins: [
    vinext({
      cache: { cdn: cdnAdapter() },
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
