// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://metallo-teste-colaborador.metallo-gunswiz.workers.dev/colaborador/epis"}
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it, vi } from "vitest";
import { signatureRequest3f } from "@/04_SERVICOS/assinatura-browser-3f";
import { TESTE_ONLINE_ASSINATURA_3F } from "@/09_CONFIGURACOES/ambiente-teste-online";

it("biometria 3F online fala só com a Edge Function do projeto de teste", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"methods":[],"events":[]}', { status: 200 }));
  try {
    await signatureRequest3f("jwt-sintetico", { action: "state" });
    expect(fetcher).toHaveBeenCalledWith(TESTE_ONLINE_ASSINATURA_3F, expect.objectContaining({ method: "POST", credentials: "omit", redirect: "error" }));
    expect(TESTE_ONLINE_ASSINATURA_3F).toBe("https://cvimwiqokkujfhwynhmt.supabase.co/functions/v1/assinatura-epi-3f");
  } finally { fetcher.mockRestore(); }
});

it("formato canônico 3F-v1 é idêntico no site e na Edge Function", () => {
  const body = (file: string) => {
    const text = readFileSync(resolve(__dirname, file), "utf8").replace(/\r\n/g, "\n");
    return text.slice(text.indexOf("const uuid = z.uuid();")).replace(/^\s*\/\/.*$/gm, "").replace(/\s+/g, " ").trim();
  };
  expect(body("../../04_BANCO_E_SUPABASE/supabase/functions/assinatura-epi-3f/canonico.ts"))
    .toBe(body("../03_FUNCOES_E_LOGICA/Assinatura/epi-signature-3f.ts"));
});
