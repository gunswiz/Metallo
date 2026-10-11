import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GUIA_FUNCIONARIO, partesDestaque, textoParaOuvir } from "@/03_FUNCOES_E_LOGICA/Guia/guia-funcionario";
import { ComoUsar } from "@/app/colaborador/[[...screen]]/como-usar";
import { GuiaInicio } from "@/app/colaborador/[[...screen]]/guia-inicio";

// Marco 8A (Bloco 5) — guia simples do app do funcionário.
afterEach(() => { cleanup(); vi.useRealTimers(); try { window.localStorage.clear(); } catch { /* sem armazenamento */ } });
const espera = () => act(async () => { await new Promise(r => setTimeout(r, 5)); });

describe("8A — conteúdo do guia", () => {
  it("começa pelo básico: bater o ponto primeiro, depois sem internet e avisos", () => {
    expect(GUIA_FUNCIONARIO.map(g => g.id)).toEqual(["ponto", "sem-internet", "avisos", "tela-inicio"]);
    expect(GUIA_FUNCIONARIO[0].passos.some(p => p.texto.includes("**Registrar ponto**"))).toBe(true);
  });
  it("frases curtas (cada passo com no máximo 160 letras)", () => {
    for (const g of GUIA_FUNCIONARIO) for (const p of g.passos) expect(p.texto.replace(/\*\*/g, "").length).toBeLessThanOrEqual(160);
  });
  it("texto para ouvir sem asteriscos e com os passos numerados", () => {
    const t = textoParaOuvir(GUIA_FUNCIONARIO[0]);
    expect(t).not.toContain("*"); expect(t).toContain("Passo 2. Na tela de início, toque no botão azul Registrar ponto.");
  });
  it("destaque do nome do botão", () => {
    expect(partesDestaque("Toque em **Entrar** agora")).toEqual([{ texto: "Toque em ", destaque: false }, { texto: "Entrar", destaque: true }, { texto: " agora", destaque: false }]);
  });
});

describe("8A — tela Como usar o app", () => {
  it("lista os assuntos e abre o passo a passo com o desenho do botão", async () => {
    render(<ComoUsar/>); await espera();
    fireEvent.click(screen.getByRole("button", { name: /^Bater o ponto\s*Leva/ }));
    expect(screen.getByRole("heading", { name: "Bater o ponto" })).toBeInTheDocument();
    expect(screen.getAllByText("Registrar ponto").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole("button", { name: /Ouvir/ })).toBeNull(); // sem voz no navegador de teste: não mostra o botão
    fireEvent.click(screen.getByRole("button", { name: "Entendi" }));
    expect(screen.getByRole("heading", { name: "Como usar o app" })).toBeInTheDocument();
  });
  it("lê em voz alta em português quando o celular tem voz", async () => {
    const speak = vi.fn(), cancel = vi.fn();
    Object.assign(window, { speechSynthesis: { speak, cancel, getVoices: () => [] }, SpeechSynthesisUtterance: class { lang = ""; rate = 1; voice = null; onend = null; onerror = null; constructor(public text: string) {} } });
    try {
      render(<ComoUsar/>); await espera();
      fireEvent.click(screen.getByRole("button", { name: /Ver os avisos/ })); await espera();
      fireEvent.click(screen.getByRole("button", { name: /Ouvir a explicação/ }));
      expect(speak).toHaveBeenCalledTimes(1);
      expect(speak.mock.calls[0][0]).toMatchObject({ lang: "pt-BR" });
      expect(speak.mock.calls[0][0].text).toContain("Ver os avisos.");
      expect(screen.getByRole("button", { name: /Parar/ })).toBeInTheDocument();
    } finally { delete (window as unknown as Record<string, unknown>).speechSynthesis; delete (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance; }
  });
});

describe("8A — convite no Início", () => {
  it("aparece até tocar em Já sei usar (e não volta)", async () => {
    const abrir = vi.fn();
    const { unmount } = render(<GuiaInicio abrir={abrir}/>); await espera();
    fireEvent.click(screen.getByRole("button", { name: "Ver como usar" })); expect(abrir).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Já sei usar" }));
    expect(screen.queryByText("Primeira vez no app?")).toBeNull(); unmount();
    render(<GuiaInicio abrir={abrir}/>); await espera();
    expect(screen.queryByText("Primeira vez no app?")).toBeNull();
  });
  it("Gestão tem a folha para imprimir, com link no Guia de uso e no Acesso ao app", () => {
    expect(readFileSync("app/(02_SISTEMA)/ajuda/page.tsx", "utf8")).toContain('href: "/ajuda/funcionario"');
    expect(readFileSync("app/(02_SISTEMA)/acesso-app/page.tsx", "utf8")).toContain('href="/ajuda/funcionario"');
    expect(readFileSync("app/(02_SISTEMA)/ajuda/funcionario/page.tsx", "utf8")).toContain("GUIA_FUNCIONARIO.map");
  });
});
