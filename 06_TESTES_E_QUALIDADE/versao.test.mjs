import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { validateRelease, readRelease } from "../07_CONFIGURACOES_DO_PROJETO/validar-versao.mjs";

const input = () => ({ mobile: "version: 0.9.8+49\n", web: { version: "0.9.8" }, root: { version: "0.9.8" }, candidate: { version: "0.9.8", build: 49, apk_url: "https://github.com/gunswiz/Metallo/releases/download/v0.9.8/Metallo.apk" }, current: { version: "0.9.7", build: 48 }, tag: "v0.9.8" });
test("versões reais do projeto correspondem ao candidato", () => {
  assert.ok(readRelease(fileURLToPath(new URL("../", import.meta.url))).build > 0);
});
test("rejeita versão divergente e tag errada", () => {
  assert.throws(() => validateRelease({ ...input(), web: { version: "0.9.7" } }));
  assert.throws(() => validateRelease({ ...input(), tag: "v0.9.7" }));
});
test("não permite regressão nem número de build reaproveitado", () => {
  assert.throws(() => validateRelease({ ...input(), current: { build: 50 } }));
  assert.throws(() => validateRelease({ ...input(), current: { build: 49, version: "0.9.7" } }));
  assert.doesNotThrow(() => validateRelease({ ...input(), current: input().candidate }));
});
test("recusa APK fora da release oficial correspondente", () => {
  assert.throws(() => validateRelease({ ...input(), candidate: { ...input().candidate, apk_url: "https://example.com/Metallo.apk" } }));
});
