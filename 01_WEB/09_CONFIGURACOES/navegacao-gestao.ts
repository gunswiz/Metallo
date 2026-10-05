import { can, type Capability } from "@metallo/core";
import type { SessionProfile } from "@metallo/types";

// Marco 3K: menu da Gestão por "o que eu preciso fazer", em grupos curtos.
// Computador: menu lateral completo. Celular: barra inferior (Início · Lançar · Pedidos · Menu).
export type ItemMenu = { href: string; label: string; capability: Capability; icone: string;
  // Recurso novo: só laboratório e teste online (fora da produção).
  newFeature?: boolean; adminOnly?: boolean };
export type GrupoMenu = { id: string; label: string; icone?: string; itens: ItemMenu[] };

export const GRUPOS_MENU: GrupoMenu[] = [
  { id: "inicio", label: "", itens: [
    { href: "/dashboard", label: "Início", capability: "dashboard:read", icone: "inicio" },
    { href: "/lancar", label: "Lançar", capability: "dashboard:read", icone: "lancar" },
  ] },
  { id: "estoque", label: "Estoque", icone: "estoque", itens: [
    { href: "/estoque", label: "Estoque das obras", capability: "inventory:read", icone: "estoque" },
    { href: "/materiais", label: "Materiais", capability: "inventory:read", icone: "materiais" },
    { href: "/epis", label: "EPIs e fardamento", capability: "epi:read", icone: "epis" },
    { href: "/ferramentas", label: "Itens pessoais", capability: "epi:read", icone: "ferramentas" },
    { href: "/equipamentos", label: "Equipamentos", capability: "inventory:read", icone: "equipamentos" },
    { href: "/movimentacoes", label: "Histórico de movimentações", capability: "inventory:read", icone: "historico" },
  ] },
  { id: "pedidos", label: "Pedidos", icone: "caixa", itens: [
    { href: "/pedidos-adm", label: "Pedidos à ADM", capability: "inventory:read", icone: "compras" },
    { href: "/pedidos", label: "Pedidos dos funcionários", capability: "epi:write", icone: "caixa", newFeature: true },
    { href: "/locacoes", label: "Máquinas alugadas", capability: "inventory:read", icone: "locacoes" },
  ] },
  { id: "pessoas", label: "Pessoas", icone: "equipes", itens: [
    { href: "/funcionarios", label: "Funcionários", capability: "epi:read", icone: "funcionarios" },
    { href: "/treinamentos", label: "Treinamentos e ASO", capability: "epi:write", icone: "treinamentos", newFeature: true },
    { href: "/apoio", label: "Funcionários em apoio", capability: "epi:read", icone: "apoio" },
    { href: "/equipes", label: "Equipes", capability: "inventory:read", icone: "equipes" },
    { href: "/comunicados", label: "Comunicados", capability: "admin:manage", icone: "comunicados", newFeature: true },
    { href: "/ponto-laboratorio", label: "Ponto (teste)", capability: "admin:manage", icone: "ponto", newFeature: true },
  ] },
  { id: "obras", label: "Obras e relatórios", icone: "obras", itens: [
    { href: "/obras", label: "Obras", capability: "inventory:read", icone: "obras" },
    { href: "/consumo", label: "Consumo", capability: "inventory:read", icone: "consumo" },
    { href: "/relatorios", label: "Relatórios", capability: "inventory:read", icone: "relatorios" },
  ] },
  { id: "admin", label: "Administração", icone: "configuracoes", itens: [
    { href: "/usuarios", label: "Usuários", capability: "admin:manage", icone: "usuarios" },
    { href: "/configuracoes", label: "Configurações", capability: "admin:manage", icone: "configuracoes" },
    { href: "/minha-conta", label: "Minha conta", capability: "dashboard:read", icone: "conta" },
    { href: "/ajuda", label: "Guia de uso", capability: "dashboard:read", icone: "ajuda" },
  ] },
];

// Seções antigas de "Obras e pedidos" (/obras?section=...) → telas novas.
export const SECAO_ANTIGA: Record<string, string> = {
  stock: "/estoque", orders: "/pedidos-adm", rentals: "/locacoes", people: "/apoio", works: "/obras", alerts: "/dashboard#pendencias",
};

export function ativo(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Marco 3K: "Lançar" — o que se faz no dia a dia, cada um numa tela curta.
export type AcaoLancar = { slug: string; label: string; dica: string; icone: string; pode: (profile: SessionProfile) => boolean };
export const ACOES_LANCAR: AcaoLancar[] = [
  { slug: "consumo", label: "Registrar consumo", dica: "Material usado na obra", icone: "consumo", pode: profile => can(profile, "consumption:write") },
  { slug: "receber", label: "Receber material ou EPI", dica: "Chegou um pedido ou uma entrada sem pedido", icone: "estoque",
    pode: profile => ["materials:write", "epi:write", "requests:write", "rentals:write"].some(key => can(profile, key as never)) },
  { slug: "entregar-epi", label: "Entregar EPI", dica: "Para um funcionário", icone: "epis", pode: profile => can(profile, "epi:write") },
  { slug: "pedido", label: "Pedir à ADM", dica: "Compra de material ou EPI", icone: "compras", pode: profile => can(profile, "requests:write") },
  { slug: "material", label: "Transferir ou dar baixa", dica: "Material entre obras, devolução ou saída", icone: "materiais", pode: profile => can(profile, "materials:write") },
  { slug: "equipamento", label: "Mover equipamento", dica: "Transferir, manutenção ou situação", icone: "equipamentos", pode: profile => can(profile, "equipment:write") },
  { slug: "transferir-epi", label: "Transferir EPI", dica: "Lote entre a COSEM e as obras", icone: "outros", pode: profile => can(profile, "epi:write") },
];
