// Marco 4K (ponto sem internet), 4J (hora oficial) e 3U (avisos do funcionário).
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ehFalhaDeConexao, gravarSincronia, guardarNaFila, horaParaMarcar, LIMITE_FILA, lerFila, lerSincronia, RECUSA_DEFINITIVA, textoConferir, textoRecusa, diferencaTexto } from "@/03_FUNCOES_E_LOGICA/Ponto/fila-offline-4k";
import { perfilOffline, PERFIL_OFFLINE_KEY, semConexao } from "@/03_FUNCOES_E_LOGICA/Autenticacao/use-colaborador-session";
import { PORTAL_STORAGE_KEY } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";
import { AvisosFuncionario } from "@/app/colaborador/[[...screen]]/avisos-funcionario";

afterEach(() => { cleanup(); window.localStorage.clear(); vi.restoreAllMocks(); });
const SERVIDOR = "2026-10-09T10:00:00.000Z";

describe("hora da marcação sem internet", () => {
  it("nunca conferiu com o servidor: usa o celular e marca SEM_CONFERENCIA", () => {
    const r = horaParaMarcar(null, Date.parse("2026-10-09T10:05:00Z"), 0);
    expect(r.metodo).toBe("SEM_CONFERENCIA"); expect(r.ajuste_ms).toBeNull(); expect(r.hora.toISOString()).toBe("2026-10-09T10:05:00.000Z");
  });
  it("mesma página aberta: usa hora do servidor + tempo contínuo, mesmo se o relógio do celular for atrasado", () => {
    const sinc = { server_at: SERVIDOR, device_at: Date.parse(SERVIDOR), monotonic: 1000, page: "p1" };
    // 5 min depois pelo tempo contínuo, mas o celular foi atrasado 20 min.
    const r = horaParaMarcar(sinc, Date.parse(SERVIDOR) + 5 * 60000 - 20 * 60000, 1000 + 5 * 60000, "p1");
    expect(r.metodo).toBe("RELOGIO_CONTINUO"); expect(r.hora.toISOString()).toBe("2026-10-09T10:05:00.000Z");
  });
  it("página reaberta sem internet: celular corrigido pelo ajuste medido na última conferência", () => {
    const sinc = { server_at: SERVIDOR, device_at: Date.parse(SERVIDOR) - 90000, monotonic: 0, page: "outra" }; // celular 90 s atrasado
    const r = horaParaMarcar(sinc, Date.parse("2026-10-09T11:00:00Z") - 90000, 5, "p1");
    expect(r.metodo).toBe("RELOGIO_DO_CELULAR"); expect(r.ajuste_ms).toBe(90000); expect(r.hora.toISOString()).toBe("2026-10-09T11:00:00.000Z");
  });
  it("celular dormiu (contador parado): vale o celular corrigido", () => {
    const sinc = { server_at: SERVIDOR, device_at: Date.parse(SERVIDOR), monotonic: 0, page: "p1" };
    const r = horaParaMarcar(sinc, Date.parse(SERVIDOR) + 3600000, 60000, "p1");
    expect(r.metodo).toBe("RELOGIO_DO_CELULAR"); expect(r.hora.toISOString()).toBe("2026-10-09T11:00:00.000Z");
  });
  it("conferência gravada usa o meio da ida e volta e recusa resposta lenta demais", () => {
    expect(gravarSincronia(SERVIDOR, 1000, 1400, 7)?.device_at).toBe(1200);
    expect(lerSincronia()?.server_at).toBe(SERVIDOR);
    expect(gravarSincronia(SERVIDOR, 0, 20000, 7)).toBeNull();
  });
});

describe("fila no celular", () => {
  const item = (n: number, emp = "joao") => ({ key: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, employee_id: emp, marking_at: SERVIDOR, location: null,
    proof: { employee_id: emp, metodo: "RELOGIO_DO_CELULAR" as const, hora_aparelho: SERVIDOR, ajuste_ms: 0, sincronizado_em: SERVIDOR } });
  it("mesma chave não duplica; outra pessoa não vê a fila", () => {
    expect(guardarNaFila(item(1))).toBe(true); expect(guardarNaFila(item(1))).toBe(true);
    expect(lerFila("joao")).toHaveLength(1); expect(lerFila("maria")).toHaveLength(0);
  });
  it(`limite de ${LIMITE_FILA} marcações guardadas`, () => {
    for (let i = 0; i < LIMITE_FILA; i++) expect(guardarNaFila(item(i))).toBe(true);
    expect(guardarNaFila(item(99))).toBe(false);
  });
  it("separa falha de conexão de recusa definitiva", () => {
    expect(ehFalhaDeConexao(new TypeError("Failed to fetch"))).toBe(true);
    expect(ehFalhaDeConexao(new Error("SERVIDOR_INDISPONIVEL"))).toBe(true);
    expect(ehFalhaDeConexao(new Error("MARCACAO_OFFLINE_ANTIGA"))).toBe(false);
    expect(RECUSA_DEFINITIVA.test("LIMITE_OFFLINE")).toBe(true); expect(RECUSA_DEFINITIVA.test("SESSAO_INVALIDA")).toBe(false);
    expect(textoRecusa("MARCACAO_NO_FUTURO")).toMatch(/adiantada/);
  });
  it("textos simples para a Gestão", () => {
    expect(textoConferir(["RELOGIO_DO_CELULAR_MUDOU"])).toMatch(/relógio do celular foi mudado/);
    expect(diferencaTexto(-7)).toBe("7 milésimos de segundo"); expect(diferencaTexto(1500)).toBe("1,5 s"); expect(diferencaTexto(null)).toBe("—");
  });
});

describe("app aberto sem internet", () => {
  const perfil = { employee_id: "11111111-1111-4111-8111-111111111111", full_name: "João Sintético", profession: null, team_name: null };
  it("libera o perfil guardado só para a MESMA sessão salva no aparelho", () => {
    window.localStorage.setItem(PERFIL_OFFLINE_KEY, JSON.stringify({ user_id: "u1", profile: perfil }));
    expect(perfilOffline()).toBeNull(); // sem sessão salva
    window.localStorage.setItem(PORTAL_STORAGE_KEY, JSON.stringify({ user: { id: "u2" } }));
    expect(perfilOffline()).toBeNull(); // outra pessoa
    window.localStorage.setItem(PORTAL_STORAGE_KEY, JSON.stringify({ user: { id: "u1" } }));
    expect(perfilOffline()).toEqual(perfil);
  });
  it("reconhece falta de internet", () => {
    expect(semConexao(new Error("Failed to fetch"))).toBe(true);
    expect(semConexao(new Error("Invalid login credentials"))).toBe(false);
  });
});

describe("arquivos de apoio", () => {
  it("service worker do funcionário guarda o app, mas nunca /api", () => {
    const sw = readFileSync("public/sw.js", "utf8");
    expect(sw).toContain(`searchParams.get("app") === "funcionario"`);
    expect(sw).toContain(`!url.pathname.startsWith("/api/")`);
    expect(sw).toContain(`"/colaborador/inicio"`);
  });
  it("manifesto do funcionário abre no Início do funcionário", () => {
    const m = JSON.parse(readFileSync("public/manifest-funcionario.webmanifest", "utf8"));
    expect(m.start_url).toBe("/colaborador/inicio"); expect(m.display).toBe("standalone");
  });
  it("Edge Function do ponto aceita marcação sem internet e informa a hora oficial", () => {
    const f = readFileSync("../04_BANCO_E_SUPABASE/supabase/functions/ponto-4d/index.ts", "utf8");
    expect(f).toContain(`path === "/v4a/offline"`); expect(f).toContain("ponto.registrar_offline("); expect(f).toContain("hlb_verified: row.h.valida === true");
    const h = readFileSync("../04_BANCO_E_SUPABASE/supabase/functions/hora-oficial/index.ts", "utf8");
    expect(h).toContain("https://ntp.br/"); expect(h).not.toMatch(/console\.log/);
  });
  it("SQL 4K grava a prova e marca para conferir em vez de alterar a hora", () => {
    const s = readFileSync("../04_BANCO_E_SUPABASE/teste-online/4k-ponto-sem-internet.sql", "utf8");
    expect(s).toContain("m.online := false"); expect(s).toContain("RELOGIO_DO_CELULAR_MUDOU"); expect(s).toContain("MARCACAO_OFFLINE_ANTIGA");
    const u = readFileSync("../04_BANCO_E_SUPABASE/teste-online/3u-avisos-funcionario.sql", "utf8");
    expect(u).toContain("em_horario_de_trabalho_3u"); expect(u).toContain("Se já bateu, pode ignorar.");
  });
});

describe("avisos no celular do funcionário", () => {
  const acoes = { ler: vi.fn(async () => ({ aparelhos: 1, lembrete_ponto: true, outros_avisos: true })), salvar: vi.fn(async () => undefined),
    apagar: vi.fn(async () => undefined), preferir: vi.fn(async () => undefined), testar: vi.fn(async () => true) };
  function aparelho(comAssinatura: boolean) {
    const sub = { endpoint: "https://push.exemplo/1", toJSON: () => ({ endpoint: "https://push.exemplo/1", keys: { p256dh: "x".repeat(40), auth: "y".repeat(16) } }), unsubscribe: vi.fn() };
    const reg = { pushManager: { getSubscription: vi.fn(async () => comAssinatura ? sub : null), subscribe: vi.fn(async () => sub) } };
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistration: vi.fn(async () => reg), register: vi.fn(async () => reg), ready: Promise.resolve(reg) } });
    Object.defineProperty(window, "PushManager", { configurable: true, value: function PushManager() {} });
    Object.defineProperty(window, "Notification", { configurable: true, value: { permission: "default", requestPermission: vi.fn(async () => "granted") } });
    return reg;
  }
  it("desligado: explica e liga pelo próprio funcionário", async () => {
    const reg = aparelho(false);
    render(<AvisosFuncionario acoes={acoes}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Ligar avisos" }));
    await waitFor(() => expect(acoes.salvar).toHaveBeenCalledWith("https://push.exemplo/1", "x".repeat(40), "y".repeat(16)));
    expect(reg.pushManager.subscribe).toHaveBeenCalled();
    expect(await screen.findByText("Avisos ligados neste celular.")).toBeInTheDocument();
  });
  it("ligado: escolhe o que receber e testa", async () => {
    aparelho(true);
    render(<AvisosFuncionario acoes={acoes}/>);
    fireEvent.click(await screen.findByRole("checkbox", { name: /Lembrete na hora do ponto/ }));
    await waitFor(() => expect(acoes.preferir).toHaveBeenCalledWith(false, true));
    fireEvent.click(screen.getByRole("button", { name: "Enviar um aviso de teste" }));
    expect(await screen.findByText(/Aviso de teste enviado/)).toBeInTheDocument();
  });
});
