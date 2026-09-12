import { test } from "node:test";
import assert from "node:assert/strict";
import { activateUpdate } from "../07_CONFIGURACOES_DO_PROJETO/ativar-atualizacao.mjs";
const candidate = { version: "0.9.8", build: 49, apk_url: "https://github.com/gunswiz/Metallo/releases/download/v0.9.8/Metallo.apk" };
function setup({ draft = false, build = 48, conflict = false, staleMain = false, wrongConfirmation = false } = {}) {
  const writes = [];
  const reads = [];
  const commitSha = "a".repeat(40);
  let current = { ...candidate, build };
  const original = { ...current };
  const request = async (url, options) => {
    let data;
    if (url.includes("releases/tags/")) data = { draft, prerelease: false, assets: [{ name: "Metallo.apk", state: "uploaded", size: 123, browser_download_url: candidate.apk_url }] };
    else if (options.method === "PUT") {
      writes.push(JSON.parse(options.body));
      if (conflict) return { ok: false, status: 409 };
      current = JSON.parse(Buffer.from(writes[0].content, "base64")); data = { commit: { sha: commitSha } };
    } else {
      reads.push(url);
      const isMain = new URL(url).searchParams.get("ref") === "main";
      const value = staleMain && isMain ? original : wrongConfirmation && !isMain ? { ...current, version: "unexpected" } : current;
      data = { sha: "original-sha", content: Buffer.from(JSON.stringify(value)).toString("base64") };
    }
    return { ok: true, json: async () => data };
  };
  return { writes, reads, commitSha, run: () => activateUpdate({ candidate, tag: "v0.9.8", repository: "gunswiz/Metallo", token: "fake-test-token", request }) };
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

test("confirma o commit gravado mesmo quando main ainda retorna o manifesto antigo", async () => {
  const { run, writes, reads, commitSha } = setup({ staleMain: true });
  assert.match(await run(), /ativada/);
  assert.equal(writes.length, 1);
  assert.equal(new URL(reads.at(-1)).searchParams.get("ref"), commitSha);
});

test("recusa confirmação de outra versão mesmo com o mesmo build e URL", async () => {
  const { run, writes } = setup({ wrongConfirmation: true });
  await assert.rejects(run, /confirmar a ativação/);
  assert.equal(writes.length, 1);
});
