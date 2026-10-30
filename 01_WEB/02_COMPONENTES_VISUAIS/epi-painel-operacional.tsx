import Link from "next/link";
import { ArrowUpRight, PackageCheck, ShieldCheck } from "lucide-react";
import type { ApprovedExchange3d, PreparedKit3d, DeliveryFeedback3d } from "@/05_ACESSO_A_DADOS/Repositorios/epi-operacoes-repository";
import styles from "./epi-painel-operacional.module.css";

type Fluxo = { prepared: PreparedKit3d[]; approved: ApprovedExchange3d[]; feedback: DeliveryFeedback3d[] };
export function EpiPainelOperacional({ fluxo }: { fluxo: Fluxo }) {
  const preparados = fluxo.prepared.filter(p => !p.delivery_group_id);
  const preparar = fluxo.approved.filter(r => !r.delivery_group_id && !preparados.some(p => p.exchange_request_id === r.request_id));
  const divergencias = fluxo.feedback.filter(f => f.feedback_status === "DIVERGENCIA" || f.feedback_status === "EM_ANALISE");
  const confirmar = fluxo.feedback.filter(f => f.feedback_status === null || f.feedback_status === "RESOLVIDA");
  return <section className={styles.panel} aria-label="Operação de EPI">
    <header className={styles.header}><div><span>PROTEÇÃO INDIVIDUAL</span><h2>Da solicitação ao recebimento.</h2><p>Cada etapa mantém seu registro. Aprovar não entrega; preparar não baixa estoque.</p></div><ShieldCheck size={46} aria-hidden/></header>
    <nav className={styles.stages} aria-label="Etapas de entrega"><Link href="/epis/solicitacoes"><span>01 · Analisar</span><strong>Solicitações</strong></Link><a href="#epi-preparar"><span>02 · Preparar</span><strong>{preparar.length} {preparar.length === 1 ? "troca aprovada" : "trocas aprovadas"}</strong></a><Link href="/epis/entrega-em-lote#kits-preparados"><span>03 · Entregar</span><strong>{preparados.length} {preparados.length === 1 ? "kit separado" : "kits separados"}</strong></Link><Link href="/epis/entrega-em-lote#confirmacoes"><span>04 · Confirmar</span><strong>{confirmar.length} aguardando funcionário</strong></Link></nav>
    {divergencias.length > 0 && <div className={styles.attention}><div><strong>{divergencias.length} {divergencias.length === 1 ? "entrega precisa" : "entregas precisam"} de conferência</strong><p>O funcionário informou diferença no recebimento. Confira os itens antes de encerrar.</p></div><Link href="/epis/entrega-em-lote#confirmacoes">Tratar divergências<ArrowUpRight size={16} aria-hidden/></Link></div>}
    <div className={styles.queue} id="epi-preparar"><div className={styles.queueHeading}><h3>Prontas para separar</h3><Link href="/epis/entrega-em-lote">Preparar nova entrega<ArrowUpRight size={16} aria-hidden/></Link></div>
      {preparar.length === 0 ? <p className={styles.empty}><PackageCheck size={22} aria-hidden/>Nenhuma troca aprovada aguardando preparação.</p> : <ul>{preparar.map(r => <li key={r.request_id}><div><strong>{r.employee_name}</strong><span>{r.item_name} · troca aprovada</span></div><Link href={`/epis/entrega-em-lote?employee=${encodeURIComponent(r.employee_id)}&exchange=${encodeURIComponent(r.request_id)}`}>Separar EPI<ArrowUpRight size={16} aria-hidden/></Link></li>)}</ul>}
    </div>
  </section>;
}
