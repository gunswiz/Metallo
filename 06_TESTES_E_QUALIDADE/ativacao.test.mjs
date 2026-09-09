import { test } from "node:test";
import assert from "node:assert/strict";
import { activateUpdate } from "../07_CONFIGURACOES_DO_PROJETO/ativar-atualizacao.mjs";
const candidate = { version: "0.9.8", build: 49, apk_url: "https://github.com/gunswiz/Metallo/releases/download/v0.9.8/Metallo.apk" };
function setup({ draft = false, build = 48, conflict = false } = {}) {
  const writes = [];
  let current = { ...candidate, build };
  const request = async (url, options) => {
    let data;
    if (url.includes("releases/tags/")) data = { draft, prerelease: false, assets: [{ name: "Metallo.apk", state: "uploaded", size: 123, browser_download_url: candidate.apk_url }] };
    else if (options.method === "PUT") {
      writes.push(JSON.parse(options.body));
      if (conflict) return { ok: false, status: 409 };
      current = JSON.parse(Buffer.from(writes[0].content, "base64")); data = {};
    } else data = { sha: "original-sha", content: Buffer.from(JSON.stringify(current)).toString("base64") };
    return { ok: true, json: async () => data };
  };
  return { writes, run: () => activateUpdate({ candidate, tag: "v0.9.8", repository: "gunswiz/Metallo", token: "fake-test-token", request }) };
}
test("não anuncia APK ainda em rascunho", async () => {
  const { run, writes } = setup({ draft: true }); await assert.rejects(run, /indisponível/); assert.equal(writes.length, 0);
});
test("ativa manifesto após release e confirma leitura usando SHA contra concorrência", async () => {
  const { run, writes } = setup(); assert.match(await run(), /ativada/); assert.equal(writes.length, 1); assert.equal(writes[0].sha, "original-sha"); assert.equal(writes[0].branch, "main");
});
test("não regride uma versão mais recente nem repete publicação já ativa", async () => {
  for (const build of [49, 50]) { const { run, writes } = setup({ build }); await run(); assert.equal(writes.length, 0); }
});
test("conflito não é sucesso e não força sobrescrita", async () => {
  const { run, writes } = setup({ conflict: true }); await assert.rejects(run, /409/); assert.equal(writes.length, 1);
});
