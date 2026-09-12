import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Called only by the publication job after verifying the public APK download.
// Token remains in the environment and is never printed.
export async function activateUpdate({ candidate, tag, repository, token, request = fetch }) {
  if (repository !== "gunswiz/Metallo" || tag !== `v${candidate.version}` || !token ||
      !Number.isSafeInteger(candidate.build) || candidate.build <= 0 ||
      candidate.apk_url !== `https://github.com/gunswiz/Metallo/releases/download/${tag}/Metallo.apk`) {
    throw new Error("Destino, versão ou credencial de publicação inválidos.");
  }
  const api = async (path, body) => {
    const response = await request(`https://api.github.com/repos/${repository}/${path}`, {
      method: body ? "PUT" : "GET",
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`GitHub recusou a operação (${response.status}). O manifesto não foi confirmado.`);
    return response.json();
  };
  const release = await api(`releases/tags/${encodeURIComponent(tag)}`);
  if (release.draft || release.prerelease || !release.assets?.some((asset) => asset.name === "Metallo.apk" && asset.state === "uploaded" && asset.size > 0 && asset.browser_download_url === candidate.apk_url)) {
    throw new Error("APK publicado indisponível; atualização não será anunciada.");
  }
  const path = "contents/updates/latest.json";
  const file = await api(`${path}?ref=main`);
  const current = JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));
  if (!Number.isSafeInteger(current.build)) throw new Error("Manifesto atual inválido.");
  if (current.build > candidate.build) return "Uma versão mais recente já está ativa; manifesto preservado.";
  if (current.build === candidate.build) {
    if (current.version !== candidate.version || current.apk_url !== candidate.apk_url) throw new Error("Build já utilizado por outra versão.");
    return "Atualização já ativa.";
  }
  const saved = await api(path, {
    message: `release: activate Metallo ${candidate.version} build ${candidate.build}`,
    content: Buffer.from(`${JSON.stringify(candidate, null, 2)}\n`).toString("base64"),
    sha: file.sha, branch: "main",
  });
  // The main ref can briefly return a cached response immediately after a write.
  // Verify the immutable commit returned by the write, without issuing another PUT.
  if (!/^[a-f0-9]{40}$/i.test(saved.commit?.sha ?? "")) throw new Error("GitHub não informou o commit da ativação; confira o manifesto antes de repetir.");
  const confirmed = await api(`${path}?ref=${saved.commit.sha}`);
  const manifest = JSON.parse(Buffer.from(confirmed.content, "base64").toString("utf8"));
  if (manifest.version !== candidate.version || manifest.build !== candidate.build || manifest.apk_url !== candidate.apk_url) throw new Error("Não foi possível confirmar a ativação; confira o manifesto antes de repetir.");
  return `Atualização ${candidate.version} ativada para os aplicativos instalados.`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== "--publicar") throw new Error("Use somente no workflow de publicação com --publicar.");
  const candidate = JSON.parse(readFileSync(process.argv[3], "utf8"));
  console.log(await activateUpdate({ candidate, tag: process.env.GITHUB_REF_NAME, repository: process.env.GITHUB_REPOSITORY, token: process.env.GH_TOKEN }));
}
