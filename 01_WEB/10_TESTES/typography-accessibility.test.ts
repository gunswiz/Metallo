import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "07_ESTILOS/globals.css"), "utf8");

describe("escala tipográfica e foco da interface web", () => {
  it("mantém os textos operacionais fora das escalas minúsculas", () => {
    expect(css).toContain("--font-caption: 0.8125rem");
    expect(css).toContain("--font-control: 1rem");
    expect(css).not.toMatch(/font-size:\s*(?:[0-9]|1[0-2])px/);
  });

  it("mantém foco visível para navegação por teclado", () => {
    expect(css).toContain(":focus-visible");
    expect(css).toContain("outline: 3px solid");
  });
});

function arquivosCss(pasta: string): string[] {
  return readdirSync(pasta).flatMap(nome => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return nome === "node_modules" || nome.startsWith(".") ? [] : arquivosCss(caminho);
    return nome.endsWith(".css") ? [caminho] : [];
  });
}

describe("letra mínima de 13px em todas as telas", () => {
  it("nenhum CSS do site usa fonte menor que 13px", () => {
    const pastas = ["02_COMPONENTES_VISUAIS", "07_ESTILOS", "app"].map(p => resolve(process.cwd(), p));
    const pequenas = pastas.flatMap(arquivosCss).flatMap(arquivo =>
      (readFileSync(arquivo, "utf8").match(/font-size:\s*(?:[0-9]|1[0-2])(?:\.\d+)?px/g) ?? []).map(t => `${arquivo}: ${t}`));
    expect(pequenas).toEqual([]);
  });
});
