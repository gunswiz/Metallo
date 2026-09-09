import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
