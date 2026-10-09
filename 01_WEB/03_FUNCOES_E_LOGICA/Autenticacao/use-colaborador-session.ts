"use client";
import { JORNADA_PADRAO, jornadaSchema, TIPOS_OCORRENCIA, type ExtrasEspelho, type TipoOcorrencia } from "@/03_FUNCOES_E_LOGICA/Ponto/espelho-4e";

import { useCallback, useEffect, useRef, useState } from "react";
import { marcacaoEmAndamento } from "@/03_FUNCOES_E_LOGICA/Ponto/marcacao-em-andamento";
import { disposePortalClient, exchangeableEpis, exchangeRequests, friendlyPortalError, LAB_URL, personalDeliveryGroups3d, personalEpis, personalProfile, personalTeam, personalWork, portalClient, portalFetch, PORTAL_STORAGE_KEY, epiAwareness3i, type PersonalProfile, type PersonalEpi, type ExchangeCreateOutcome } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";
import { pointRequest } from "@/05_ACESSO_A_DADOS/Ponto/ponto-lab";
import { epiReportPayloadSchema } from "@/03_FUNCOES_E_LOGICA/Relatorios/epi-report-3e";
import { personalItem3g, type PersonalItem3g } from "@/03_FUNCOES_E_LOGICA/ItensPessoais/contrato-3g";
import { communicationDetail3h, communicationSummary3h } from "@/03_FUNCOES_E_LOGICA/Comunicados/contrato-3h";
import { z } from "zod";
import { ficha5a, type Ficha5a } from "@/03_FUNCOES_E_LOGICA/Treinamentos/contrato-5a";
import { confirmPassword3j, PasswordConfirmError } from "@/04_SERVICOS/assinatura-browser-3f";

export type PortalScreen = "login" | "inicio" | "perfil" | "equipe" | "obra" | "epis" | "ponto" | "registros" | "espelho" | "comprovantes" | "itens" | "comunicados" | "treinamentos";
const visualProfile: PersonalProfile = { employee_id: "synthetic-preview", full_name: "João Sintético", profession: "Profissão de teste", team_name: null };
const visualEpis: PersonalEpi[] = [
  { item_name: "Capacete de segurança", ca_number: "12345", quantity: 1, unit: "un", variant: "M", delivered_at: "2026-08-12T12:00:00Z", delivery_reason: "initial", current_status: "active", closed_at: null },
  { item_name: "Luva de proteção", ca_number: "67890", quantity: 2, unit: "par", variant: "G", delivered_at: "2026-08-20T12:00:00Z", delivery_reason: "replacement", current_status: "active", closed_at: null },
  { item_name: "Luva de proteção", ca_number: "67890", quantity: 1, unit: "par", variant: "M", delivered_at: "2026-06-10T12:00:00Z", delivery_reason: "initial", current_status: "replaced", closed_at: "2026-08-20T12:00:00Z" },
];
const visualTrainings5a: Ficha5a = { name: "João Sintético", profession: "welder", situacao: "VENCE_EM_BREVE",
  aso: { aso_exam_date: "2026-01-10", aso_expiry_date: "2027-01-10", situacao: "EM_DIA" },
  trainings: [{ id: "33333333-3333-4333-8333-333333333333", type_code: "NR35", name: "Trabalho em altura", nr: "NR-35",
    completed_on: "2024-10-20", expires_on: "2026-10-20", provider: null, workload_hours: 8, situacao: "VENCE_EM_BREVE", required: true }],
  missing: [] };
const visualItems3g: PersonalItem3g[] = [
  { delivery_id: "11111111-1111-4111-8111-111111111111", item_name: "Trena 5 m", quantity: 1, unit: "un",
    variant: "5 m", delivered_at: "2026-09-29T12:00:00Z", confirmed_at: null, status: "AGUARDANDO_CONFIRMACAO", events: [] },
  { delivery_id: "22222222-2222-4222-8222-222222222222", item_name: "Esquadro 12\"", quantity: 1, unit: "un",
    variant: "12\"", delivered_at: "2026-09-27T12:00:00Z", confirmed_at: "2026-09-27T14:00:00Z", status: "EM_USO",
    events: [{ event_type: "CONFIRMED", category: null, note: null, occurred_at: "2026-09-27T14:00:00Z" }] },
];

export function useColaboradorSession(anonKey: string, demo: boolean, screen: PortalScreen, go: (next: PortalScreen) => void, baseUrl: string = LAB_URL) {
  // Teste online: sem servidor de ponto do laboratório; a saída usa o próprio Auth do projeto de teste.
  const online = baseUrl !== LAB_URL;
  const [profile, setProfile] = useState<PersonalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const client = useRef<ReturnType<typeof portalClient> | null>(null);
  const endingClient = useRef<ReturnType<typeof portalClient> | null>(null);
  const generation = useRef(0);
  const invalidate = useCallback(() => { generation.current += 1; }, []);
  const checking = useRef<number | null>(null);
  const getClient = useCallback(() => client.current ??= portalClient(anonKey, baseUrl), [anonKey, baseUrl]);

  const endSession = useCallback(async (message = "", redirect = true, scope?: "current" | "global") => {
    const ticket = ++generation.current;
    setProfile(null); setError(message); setLoading(false); setBusy(true);
    const previous = client.current;
    endingClient.current = previous;
    client.current = null;
    let finalMessage = message;
    try {
      if (scope && online) {
        try {
          const result = await previous?.auth.signOut({ scope: scope === "global" ? "global" : "local" });
          if (result?.error) throw result.error;
        } catch {
          finalMessage = scope === "global" ? "Não foi possível confirmar a saída de todos os dispositivos. Procure a administração." : "Não foi possível confirmar o encerramento no servidor. Entre novamente ou procure a administração.";
        }
      } else if (scope) {
        try {
          const session = await previous?.auth.getSession();
          const token = session?.data.session?.access_token;
          if (!token) throw new Error("SESSAO_INVALIDA");
          const result = await pointRequest(`/lab-point/v1/session/${scope}`, token, { method: "POST" });
          if (result.status !== 200 || result.body.status !== "SESSAO_ENCERRADA") throw new Error("ENCERRAMENTO_PENDENTE");
        } catch {
          finalMessage = scope === "global" ? "Não foi possível confirmar a saída de todos os dispositivos. Procure a administração." : "Não foi possível confirmar o encerramento no servidor. Entre novamente ou procure a administração.";
        }
      }
      await previous?.auth.signOut({ scope: "local" });
    } catch { /* Offline: limpar também memória e persistência. */ }
    finally {
      if (previous) disposePortalClient(previous);
      if (endingClient.current === previous) endingClient.current = null;
      if (ticket !== generation.current) return;
      setError(finalMessage);
      window.localStorage.removeItem(PORTAL_STORAGE_KEY);
      window.localStorage.removeItem(`${PORTAL_STORAGE_KEY}-code-verifier`);
      if (redirect) go("login");
      setBusy(false);
    }
  }, [go, online]);

  useEffect(() => () => {
    invalidate();
    if (client.current) disposePortalClient(client.current);
    if (endingClient.current) disposePortalClient(endingClient.current);
    client.current = null;
    endingClient.current = null;
  }, [invalidate]);

  const verify = useCallback(async (target = screen, foreground = true) => {
    // Saída em curso não pode reabrir a sessão antiga por foco ou polling.
    // Uma mudança de storage invalida/descarta esse cliente antes de revalidar.
    if (endingClient.current) return;
    if (demo) {
      const ended = target === "login" || window.sessionStorage.getItem("metallo-visual-ended") === "1";
      setProfile(ended ? null : visualProfile); setLoading(false);
      if (ended && target !== "login") go("login");
      return;
    }
    const ticket = generation.current;
    if (checking.current === ticket) return;
    checking.current = ticket;
    if (foreground) { setProfile(null); setLoading(true); }
    try {
      const supabase = getClient();
      const user = await supabase.auth.getUser();
      if (ticket !== generation.current) return;
      if (user.error && /fetch|network|timeout|abort/i.test(user.error.message)) throw user.error;
      if (user.error || !user.data.user) {
        if (target === "login") {
          try {
            const health = await portalFetch(`${baseUrl}/auth/v1/health`, { headers: { apikey: anonKey } }); // Supabase online exige a chave pública.
            if (!health.ok) throw new Error("Laboratório indisponível.");
          } catch {
            if (ticket === generation.current) await endSession("Não foi possível conectar ao servidor. Tente novamente.", false);
            return;
          }
        }
        await endSession(target === "login" ? "" : "Sua sessão terminou. Entre novamente.");
        return;
      }
      const result = await supabase.rpc("my_employee_profile");
      if (ticket !== generation.current) return;
      if (result.error) throw result.error;
      const person = personalProfile(result.data);
      if (!person) { await endSession("Sua conta não tem acesso ativo. Procure a administração."); return; }
      // Revalidação sem mudança mantém a mesma referência: evita reiniciar telas e operações em andamento.
      setProfile(previous => previous && previous.employee_id === person.employee_id && previous.full_name === person.full_name &&
        previous.profession === person.profession && previous.team_name === person.team_name ? previous : person); setError("");
      if (target === "login") go("inicio");
    } catch (cause) {
      if (ticket === generation.current) await endSession(friendlyPortalError(cause), false);
    } finally {
      if (checking.current === ticket) checking.current = null;
      if (ticket === generation.current) setLoading(false);
    }
  }, [anonKey, baseUrl, demo, endSession, getClient, go, screen]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void verify(); }, 0);
    const poll = demo ? undefined : window.setInterval(() => { if (screen !== "login" && document.visibilityState === "visible") void verify(screen, false); }, 5000);
    const focus = () => { if (screen !== "login") void verify(); };
    // Foco da janela volta (ex.: diálogo de permissão de localização). Regra de segurança mantida:
    // esconde e revalida, exceto durante uma marcação de ponto, que revalida em segundo plano.
    const windowFocus = () => { if (screen === "login") return; void verify(screen, !marcacaoEmAndamento()); };
    const visibility = () => {
      if (document.visibilityState === "hidden") { ++generation.current; setProfile(null); setLoading(true); }
      else focus();
    };
    const storage = (e: StorageEvent) => {
      if (demo || (e.key !== PORTAL_STORAGE_KEY && e.key !== null)) return;
      // O evento apenas invalida. A identidade nova só é aceita após Auth + RPC reais.
      invalidate();
      if (client.current) disposePortalClient(client.current);
      if (endingClient.current) disposePortalClient(endingClient.current);
      client.current = null; endingClient.current = null;
      setProfile(null); setLoading(true); setBusy(false); setError("");
      void verify();
    };
    window.addEventListener("focus", windowFocus);
    window.addEventListener("pageshow", focus);
    window.addEventListener("storage", storage);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      invalidate(); window.clearTimeout(timer); window.clearInterval(poll);
      window.removeEventListener("focus", windowFocus); window.removeEventListener("pageshow", focus);
      window.removeEventListener("storage", storage); document.removeEventListener("visibilitychange", visibility);
    };
  }, [demo, endSession, invalidate, screen, verify]);

  async function login(email: string, password: string) {
    if (busy) return;
    setBusy(true); setError(""); const ticket = ++generation.current;
    try {
      const result = await getClient().auth.signInWithPassword({ email: email.trim(), password });
      if (ticket !== generation.current) return;
      if (result.error) throw result.error;
      await verify("login");
    } catch (cause) { if (ticket === generation.current) { setProfile(null); setError(friendlyPortalError(cause)); } }
    finally { if (ticket === generation.current) setBusy(false); }
  }
  async function logout(scope: "current" | "global" = "current") {
    if (busy) return;
    setBusy(true);
    if (demo) { window.sessionStorage.setItem("metallo-visual-ended", "1"); setProfile(null); go("login"); }
    else await endSession("", true, scope);
    setBusy(false);
  }
  const readCurrentWork = useCallback(async () => {
    if (demo) return null;
    if (endingClient.current) throw new Error("Sessão em encerramento.");
    const ticket = generation.current;
    const result = await getClient().rpc("my_current_work");
    if (ticket !== generation.current || endingClient.current) throw new Error("Sessão alterada.");
    if (result.error) throw result.error;
    return personalWork(result.data);
  }, [demo, getClient]);
  const readTeamSummary = useCallback(async () => {
    if (demo) return null;
    if (endingClient.current) throw new Error("Sessão em encerramento.");
    const ticket = generation.current;
    const result = await getClient().rpc("my_team_summary");
    if (ticket !== generation.current || endingClient.current) throw new Error("Sessão alterada.");
    if (result.error) throw result.error;
    return personalTeam(result.data);
  }, [demo, getClient]);
  const readPersonalEpis = useCallback(async () => {
    if (demo) return visualEpis;
    if (endingClient.current) throw new Error("Sessão em encerramento.");
    const ticket = generation.current;
    const result = await getClient().rpc("my_personal_epi");
    if (ticket !== generation.current || endingClient.current) throw new Error("Sessão alterada.");
    if (result.error) throw result.error;
    return personalEpis(result.data);
  }, [demo, getClient]);
  const exchangeRpc = useCallback(async (name: "my_exchangeable_epi" | "my_epi_exchange_requests" | "create_epi_exchange_request" | "cancel_epi_exchange_request" | "my_epi_delivery_groups_3d" | "respond_epi_delivery_3d" | "my_epi_report_3e" | "my_personal_items_3g" | "confirm_personal_item_3g" | "report_personal_item_3g" | "my_communications_3h" | "open_communication_3h" | "my_epi_awareness_3i" | "accept_epi_awareness_3i" | "my_trainings_5a" | "jornada_padrao_4g" | "feriados_4h" | "my_ocorrencias_4h", args: Record<string, unknown> = {}) => {
    if (demo || endingClient.current || !profile) throw new Error("Sessão inválida.");
    const ticket = generation.current;
    const result = await getClient().rpc(name, args);
    if (ticket !== generation.current || endingClient.current) throw new Error("Sessão alterada.");
    if (result.error) throw result.error;
    return result.data;
  }, [demo, getClient, profile]);
  const readExchangeableEpis = useCallback(async () => exchangeableEpis(await exchangeRpc("my_exchangeable_epi")), [exchangeRpc]);
  const readExchangeRequests = useCallback(async () => exchangeRequests(await exchangeRpc("my_epi_exchange_requests")), [exchangeRpc]);
  const createExchangeRequest = useCallback(async (deliveryId: string, reason: string, note: string, idempotencyKey: string) => {
    const data = await exchangeRpc("create_epi_exchange_request", {
      p_delivery_id: deliveryId, p_reason: reason, p_note: note, p_idempotency_key: idempotencyKey,
    });
    if (!Array.isArray(data) || data.length !== 1 || typeof data[0]?.request_id !== "string" ||
      !["SOLICITADA", "EM_ANALISE", "APROVADA", "RECUSADA", "CANCELADA"].includes(data[0]?.request_status))
      throw new Error("Confirmação da solicitação inválida.");
    return { requestId: data[0].request_id, status: data[0].request_status } as ExchangeCreateOutcome;
  }, [exchangeRpc]);
  const cancelExchangeRequest = useCallback(async (requestId: string) => {
    const data = await exchangeRpc("cancel_epi_exchange_request", { p_request_id: requestId });
    if (data !== "CANCELADA") throw new Error("Confirmação de cancelamento inválida.");
  }, [exchangeRpc]);
  const readDeliveryGroups3d = useCallback(async () => personalDeliveryGroups3d(await exchangeRpc("my_epi_delivery_groups_3d")), [exchangeRpc]);
  // Marco 3I: termo de ciência (NR-6, 6.6.1). O texto e o hash vêm do servidor.
  const readEpiAwareness3i = useCallback(async () => epiAwareness3i(await exchangeRpc("my_epi_awareness_3i")), [exchangeRpc]);
  const acceptEpiAwareness3i = useCallback(async (termSha256: string, idempotencyKey: string) => {
    const data = await exchangeRpc("accept_epi_awareness_3i", { p_term_sha256: termSha256, p_idempotency_key: idempotencyKey });
    if (typeof data !== "string" || !Number.isFinite(Date.parse(data))) throw new Error("Confirmação do termo inválida.");
    return data;
  }, [exchangeRpc]);
  // Marco 5A: ASO e treinamentos do próprio funcionário (somente leitura).
  // Marco 4G: jornada padrão da empresa (para o saldo do espelho). Sem dado pessoal.
  const readJornada4g = useCallback(async () => { const r = jornadaSchema.safeParse(await exchangeRpc("jornada_padrao_4g")); return r.success ? r.data : JORNADA_PADRAO; }, [exchangeRpc]);
  // Marco 4H: feriados do período e ocorrências da própria pessoa (atestado, férias, folga, faltas) para o espelho.
  const readExtrasEspelho4h = useCallback(async (de: string, ate: string): Promise<ExtrasEspelho> => {
    const [feriados, ocorrencias] = await Promise.all([exchangeRpc("feriados_4h", { p_de: de, p_ate: ate }), exchangeRpc("my_ocorrencias_4h", { p_de: de, p_ate: ate })]);
    const f = Array.isArray(feriados) ? feriados as { data: string; nome: string }[] : [], o = Array.isArray(ocorrencias) ? ocorrencias as { data: string; tipo: TipoOcorrencia }[] : [];
    return { feriados: Object.fromEntries(f.map(x => [x.data, String(x.nome).slice(0, 80)])),
      ocorrencias: Object.fromEntries(o.filter(x => (TIPOS_OCORRENCIA as readonly string[]).includes(x.tipo)).map(x => [x.data, { tipo: x.tipo }])) };
  }, [exchangeRpc]);
  const readTrainings5a = useCallback(async () => demo ? visualTrainings5a : ficha5a.parse(await exchangeRpc("my_trainings_5a")), [demo, exchangeRpc]);
  const readPersonalReport3e = useCallback(async () => epiReportPayloadSchema.parse(await exchangeRpc("my_epi_report_3e")), [exchangeRpc]);
  const readPersonalItems3g = useCallback(async () => demo ? visualItems3g :
    z.array(personalItem3g).parse(await exchangeRpc("my_personal_items_3g")), [demo, exchangeRpc]);
  const readCommunications3h = useCallback(async (unreadOnly: boolean, offset: number) => demo ? [] :
    z.array(communicationSummary3h).parse(await exchangeRpc("my_communications_3h",
      { p_unread_only: unreadOnly, p_limit: 20, p_offset: offset })), [demo, exchangeRpc]);
  const openCommunication3h = useCallback(async (id: string) =>
    communicationDetail3h.parse(await exchangeRpc("open_communication_3h", { p_id: id })), [exchangeRpc]);
  const confirmPersonalItem3g = useCallback(async (deliveryId: string, key: string) => {
    const result = await exchangeRpc("confirm_personal_item_3g", { p_delivery_id: deliveryId, p_idempotency_key: key });
    if (!Number.isSafeInteger(result) || result <= 0) throw new Error("Confirmação inválida.");
    return result as number;
  }, [exchangeRpc]);
  const reportPersonalItem3g = useCallback(async (deliveryId: string, action: "PROBLEM" | "EXCHANGE_REQUESTED",
    category: string, note: string, key: string) => {
    const result = await exchangeRpc("report_personal_item_3g", { p_delivery_id: deliveryId,
      p_action: action, p_category: category, p_note: note || null, p_idempotency_key: key });
    if (!Number.isSafeInteger(result) || result <= 0) throw new Error("Solicitação inválida.");
    return result as number;
  }, [exchangeRpc]);
  const respondDelivery3d = useCallback(async (groupId: string, action: "CONFIRMADO" | "DIVERGENCIA",
    deliveryId: string | null, category: string | null, details: string | null, idempotencyKey: string) => {
    const result = await exchangeRpc("respond_epi_delivery_3d", {
      p_group_id: groupId, p_action: action, p_delivery_id: deliveryId, p_category: category,
      p_details: details, p_idempotency_key: idempotencyKey,
    });
    if (!Number.isSafeInteger(result) || result <= 0) throw new Error("Confirmação de entrega inválida.");
    return result as number;
  }, [exchangeRpc]);
  const getAccessToken = useCallback(async () => {
    if (demo || endingClient.current || !profile) throw new Error("Sessão inválida.");
    const ticket = generation.current;
    const result = await getClient().auth.getSession();
    if (ticket !== generation.current || endingClient.current || result.error || !result.data.session?.access_token) throw new Error("Sessão inválida.");
    return result.data.session.access_token;
  }, [demo, getClient, profile]);
  // Marco 3J: confirmar recebimento exige digital OU senha. Online, o servidor confere a senha (Edge Function).
  // No laboratório local (sem a Edge Function), a senha é conferida no Auth local antes de registrar.
  const confirmDeliveryWithPassword = useCallback(async (groupId: string, password: string, idempotencyKey: string) => {
    if (online) { await confirmPassword3j(getAccessToken, groupId, password, idempotencyKey); return; }
    const user = await getClient().auth.getUser();
    const email = user.data.user?.email;
    if (!email) throw new PasswordConfirmError("falha");
    const check = await portalFetch(`${baseUrl}/auth/v1/token?grant_type=password`, { method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    if (!check.ok) throw new PasswordConfirmError(check.status === 400 ? "senha_incorreta" : "falha");
    const temporary = await check.json() as { access_token?: string };
    if (temporary.access_token) await portalFetch(`${baseUrl}/auth/v1/logout?scope=local`, { method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${temporary.access_token}` } }).catch(() => undefined);
    await respondDelivery3d(groupId, "CONFIRMADO", null, null, null, idempotencyKey);
  }, [online, getAccessToken, getClient, baseUrl, anonKey, respondDelivery3d]);
  return { profile, loading, busy, error, login, logout, verify, readCurrentWork, readTeamSummary, readPersonalEpis, readExchangeableEpis, readExchangeRequests, createExchangeRequest, cancelExchangeRequest, readDeliveryGroups3d, respondDelivery3d, confirmDeliveryWithPassword, readPersonalReport3e, readPersonalItems3g, confirmPersonalItem3g, reportPersonalItem3g, readCommunications3h, openCommunication3h, readEpiAwareness3i, acceptEpiAwareness3i, readTrainings5a, readJornada4g, readExtrasEspelho4h, getAccessToken };
}
