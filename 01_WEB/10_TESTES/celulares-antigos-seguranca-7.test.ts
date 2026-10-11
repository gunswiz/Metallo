// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { cabecalhosGestao } from "@/proxy";

// Marcos 7A (celulares antigos) e 7B (revisão de segurança).
const compat = readFileSync("public/compat-antigos.js", "utf8");

describe("7A — celular antigo", () => {
  it("completa AbortSignal.any/timeout, .at, Object.hasOwn e randomUUID quando faltam", async () => {
    const guardado = { any: AbortSignal.any, timeout: AbortSignal.timeout, at: Array.prototype.at, hasOwn: Object.hasOwn };
    try {
      // Simula Chrome antigo: tira as funções.
      delete (AbortSignal as unknown as Record<string, unknown>).any; delete (AbortSignal as unknown as Record<string, unknown>).timeout;
      delete (Array.prototype as unknown as Record<string, unknown>).at; delete (Object as unknown as Record<string, unknown>).hasOwn;
      new Function(compat)();
      expect([1, 2, 3].at(-1)).toBe(3);
      expect(Object.hasOwn({ a: 1 }, "a")).toBe(true);
      const c = new AbortController(), junto = AbortSignal.any([c.signal, new AbortController().signal]);
      expect(junto.aborted).toBe(false); c.abort(); expect(junto.aborted).toBe(true);
      vi.useFakeTimers(); const t = AbortSignal.timeout(50); vi.advanceTimersByTime(60); expect(t.aborted).toBe(true); vi.useRealTimers();
      expect(crypto.randomUUID()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      Object.assign(AbortSignal, { any: guardado.any, timeout: guardado.timeout });
      Object.defineProperty(Array.prototype, "at", { value: guardado.at, writable: true, configurable: true });
      Object.assign(Object, { hasOwn: guardado.hasOwn });
    }
  });
  it("navegador moderno não vê aviso; o script é ES5 (roda até em Chrome muito antigo)", () => {
    new Function(compat)();
    expect(document.getElementById("aviso-navegador-antigo")).toBeNull();
    // (a única sintaxe nova fica dentro do texto do teste de sintaxe, que é avaliado à parte)
    expect(compat.split("\n").filter(l => !l.includes("new Function(")).join("\n")).not.toMatch(/=>|\blet\b|\bconst\b|`|\?\.|\?\?/);
  });
  it("o script carrega antes do app e passa pelo filtro do app do funcionário", () => {
    expect(readFileSync("app/layout.tsx", "utf8")).toContain('<script src="/compat-antigos.js" />');
    expect(readFileSync("proxy.ts", "utf8")).toContain("compat-antigos\\\\.js$");
    expect(readFileSync("vite.config.ts", "utf8")).toMatch(/build: \{ target: ALVO_NAVEGADORES \}/);
  });
  it("telas do app (fora Início e Ponto) só baixam quando abertas, com aviso se não carregar", () => {
    const app = readFileSync("app/colaborador/[[...screen]]/colaborador-app.tsx", "utf8");
    expect((app.match(/= lazy\(\(\) => import\(/g) ?? []).length).toBeGreaterThanOrEqual(12);
    expect(app).toContain('import { MeuPontoOnline } from "./meu-ponto-online";');
    expect(app).toContain("<TelaComCarga key={current}>");
  });
});

describe("7B — cabeçalhos de segurança da Gestão", () => {
  it("produção: CSP com o Supabase certo, sem abrir dentro de outro site, HTTPS obrigatório", () => {
    const r = cabecalhosGestao(NextResponse.next(), "https://abc.supabase.co", true, true);
    const csp = r.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(r.headers.get("X-Frame-Options")).toBe("DENY");
    expect(r.headers.get("Strict-Transport-Security")).toContain("max-age=");
    expect(r.headers.get("Permissions-Policy")).toContain("camera=()");
  });
  it("desenvolvimento local: sem CSP (não atrapalha o recarregamento), mas com os outros cuidados", () => {
    const r = cabecalhosGestao(NextResponse.next(), "http://127.0.0.1:54321", false, false);
    expect(r.headers.get("Content-Security-Policy")).toBeNull();
    expect(r.headers.get("Strict-Transport-Security")).toBeNull();
    expect(r.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
  it("banco: anon sem permissão de tabela; dependências com correção", () => {
    const sql = readFileSync("../04_BANCO_E_SUPABASE/teste-online/7b-seguranca-permissoes.sql", "utf8");
    expect(sql).toContain("revoke all on all tables in schema public from anon;");
    expect(readFileSync("package.json", "utf8")).toContain('"next": "16.3.8"');
    expect(readFileSync("../pnpm-workspace.yaml", "utf8")).toContain('"undici@>=7.0.0 <7.29.1": "7.30.0"');
  });
});
