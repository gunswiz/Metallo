import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function validateRelease({ mobile, web, root, candidate, current, tag }) {
  const match = /^version:\s*(\d+\.\d+\.\d+)\+(\d+)\s*$/m.exec(mobile);
  if (!match) throw new Error("Versão inválida no pubspec.yaml.");
  const [, version, buildText] = match;
  const build = Number(buildText);
  if (!Number.isSafeInteger(build) || build <= 0 || build > 2_100_000_000) throw new Error("Build Android inválido.");
  if (root.version !== version || web.version !== version || candidate.version !== version || candidate.build !== build) {
    throw new Error("As versões do Web, Mobile e manifesto precisam coincidir.");
  }
  const expectedUrl = `https://github.com/gunswiz/Metallo/releases/download/v${version}/Metallo.apk`;
  if (candidate.apk_url !== expectedUrl) throw new Error("O manifesto deve apontar para o APK oficial desta versão.");
  if (!Number.isSafeInteger(current.build) || current.build > build ||
      (current.build === build && (current.version !== version || current.apk_url !== expectedUrl))) {
    throw new Error("O build não pode regredir nem reutilizar o número de outra versão.");
  }
  if (tag && tag !== `v${version}`) throw new Error("A tag não corresponde à versão compilada.");
  return { version, build, apk_url: expectedUrl };
}

export function readRelease(projectRoot, tag) {
  const json = (path) => JSON.parse(readFileSync(resolve(projectRoot, path), "utf8"));
  return validateRelease({
    mobile: readFileSync(resolve(projectRoot, "02_MOBILE/pubspec.yaml"), "utf8"),
    web: json("01_WEB/package.json"), root: json("package.json"),
    candidate: json("updates/proxima-versao.json"), current: json("updates/latest.json"), tag,
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projectRoot = fileURLToPath(new URL("../", import.meta.url));
  const release = readRelease(projectRoot, process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined);
  console.log(`Metallo ${release.version}, build ${release.build}: versões consistentes.`);
}
