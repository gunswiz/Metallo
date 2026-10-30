"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Truck, Search, ClipboardCheck, MapPin, Wrench, FileCheck2, ChevronRight, ShieldAlert } from "lucide-react";
import { ROTULO_RESULTADO_10A, ROTULO_SITUACAO_FROTA_10A, type PainelGestao10a } from "@/03_FUNCOES_E_LOGICA/Frota/contrato-10a";
import styles from "./painel-frota.module.css";

const filtros = [{ id: "todos", nome: "Todos" }, { id: "disponivel", nome: "Disponíveis" }, { id: "em_uso", nome: "Na rua" }, { id: "atencao", nome: "Atenção" }, { id: "inativos", nome: "Desativados" }] as const;
const atencao = (v: PainelGestao10a) => v.situacao === "nao_liberado" || v.situacao === "manutencao" || v.docs_vencidos + v.docs_breve + v.planos_vencidos + v.planos_breve + v.manutencoes_abertas > 0 || !v.checklist_hoje || v.checklist_hoje !== "liberado";
const pertence = (v: PainelGestao10a, filtro: string) => filtro === "inativos" ? !v.ativo : v.ativo && (filtro === "todos" || (filtro === "atencao" ? atencao(v) : v.situacao === filtro));
const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const prioridade = (v: PainelGestao10a) => !v.ativo ? 4 : v.situacao === "nao_liberado" || v.situacao === "manutencao" ? 0 : v.docs_vencidos + v.planos_vencidos > 0 ? 1 : atencao(v) ? 2 : 3;

export function PainelFrota({ frota }: { frota: PainelGestao10a[] }) {
  const [filtro, setFiltro] = useState<string>("todos"), [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const visiveis = frota.filter(v => pertence(v, filtro) && normalizar(`${v.nome} ${v.placa} ${v.modelo ?? ""} ${v.motorista ?? ""}`).includes(normalizar(busca))).sort((a, b) => prioridade(a) - prioridade(b));
  const atual = visiveis.find(v => v.id === selecionado) ?? visiveis[0];
  const ativos = frota.filter(v => v.ativo);
  const bloqueados = ativos.filter(v => v.situacao === "nao_liberado" || v.situacao === "manutencao").length;
  const proximaAba = atual?.situacao === "nao_liberado" || atual?.situacao === "manutencao" || atual?.manutencoes_abertas ? "manutencao" : atual?.docs_vencidos ? "documentos" : atual?.planos_vencidos ? "planos" : "checklists";
  const assunto = { manutencao: "Revisar manutenção", documentos: "Regularizar documentos", planos: "Consultar preventiva", checklists: "Conferir inspeções" };
  return <section className={styles.panel} aria-label="Caminhões da frota">
    <div className={styles.overview}><div><span className={styles.eyebrow}>CONTROLE OPERACIONAL</span><h2>Uma visão de toda a operação.</h2><p>Inspeção, viagem e manutenção conectadas ao histórico de cada veículo.</p></div>
      <dl className={styles.metrics}><div><dt>Veículos ativos</dt><dd>{ativos.length}</dd></div><div><dt>Em viagem</dt><dd>{ativos.filter(v => v.situacao === "em_uso").length}</dd></div><div data-alert={bloqueados > 0}><dt>Bloqueados / oficina</dt><dd>{bloqueados}</dd></div></dl></div>
    <div className="fleet-toolbar"><div><h2>Sua frota</h2><p>Bloqueios primeiro, depois vencimentos e demais pendências.</p></div>
      <label className="fleet-search"><Search size={18} aria-hidden/><input type="search" aria-label="Buscar caminhão, placa ou motorista" placeholder="Nome, placa ou motorista" value={busca} onChange={e => setBusca(e.target.value)}/></label></div>
    <div className="fleet-filters" role="group" aria-label="Filtrar caminhões">{filtros.map(f => <button type="button" key={f.id} aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>{f.nome}<span>{frota.filter(v => pertence(v, f.id)).length}</span></button>)}</div>
    <p className="fleet-results" role="status">{visiveis.length} {visiveis.length === 1 ? "caminhão encontrado" : "caminhões encontrados"}</p>
    {visiveis.length === 0 ? <div className="fleet-empty"><Truck size={30} aria-hidden/><h3>{frota.length ? "Nenhum caminhão neste filtro" : "Sua frota começa aqui"}</h3><p>{frota.length ? "Tente outra placa, nome ou situação." : "Os caminhões cadastrados aparecerão aqui."}</p>{frota.length > 0 && <button type="button" className="button secondary" onClick={() => { setBusca(""); setFiltro("todos"); }}>Limpar filtros</button>}</div> :
      <div className={styles.workspace}><div className={styles.vehicles}>{visiveis.map(v => {
        const tom = !v.ativo ? "" : v.situacao === "disponivel" ? "good" : v.situacao === "em_uso" ? "warn" : "bad";
        const pendencias = v.manutencoes_abertas + v.docs_vencidos + v.docs_breve + v.planos_vencidos + v.planos_breve;
        return <article className={styles.vehicle} data-selected={atual?.id === v.id} key={v.id}>
          <div className={styles.identity}><span className={styles.icon}><Truck size={25} aria-hidden/></span><div><h3><Link href={`/frota/${v.id}`}>{v.nome}</Link></h3><p>{v.placa} · {v.modelo ?? "Modelo não informado"}{v.ano ? ` · ${v.ano}` : ""}</p></div><span className={`status-badge ${tom}`}>{v.ativo ? ROTULO_SITUACAO_FROTA_10A[v.situacao] : "Desativado"}</span></div>
          <div className={styles.readings}><span><strong>{v.km_atual.toLocaleString("pt-BR")}</strong> km</span><span><ClipboardCheck size={16} aria-hidden/>{v.checklist_hoje ? ROTULO_RESULTADO_10A[v.checklist_hoje] : "Inspeção pendente"}</span></div>
          {v.situacao === "em_uso" && v.ativo && <div className={styles.trip}><MapPin size={16} aria-hidden/><strong>{v.destino || "Destino não informado"}</strong><span>Com {v.motorista || "motorista não informado"}</span>{v.acompanhantes && <span>Acompanhantes: {v.acompanhantes}</span>}</div>}
          <div className={styles.rowFoot}><small>{pendencias ? `${pendencias} ${pendencias === 1 ? "pendência" : "pendências"} de manutenção/documentos` : "Sem pendências de manutenção/documentos"}</small><div><Link href={`/frota/${v.id}`}>Abrir ficha<ArrowUpRight size={15} aria-hidden/></Link><button type="button" aria-label={`Ver resumo de ${v.nome}`} aria-pressed={atual?.id === v.id} onClick={() => setSelecionado(v.id)}><ChevronRight size={20} aria-hidden/></button></div></div>
        </article>;
      })}</div>{atual && <aside className={styles.inspector} aria-label="Resumo do veículo selecionado">
        <span className={styles.eyebrow}>PRÓXIMA AÇÃO</span><h2>{assunto[proximaAba]}</h2><p className={styles.selectedName}>{atual.placa} · veículo selecionado</p>
        {(atual.situacao === "nao_liberado" || atual.situacao === "manutencao") && <p className={styles.blocked}><ShieldAlert size={20} aria-hidden/>A operação está bloqueada. Novo checklist não substitui a liberação responsável.</p>}
        <dl className={styles.details}><div><dt><Wrench size={17} aria-hidden/>Manutenções abertas</dt><dd>{atual.manutencoes_abertas}</dd></div><div><dt><FileCheck2 size={17} aria-hidden/>Documentos vencidos</dt><dd>{atual.docs_vencidos}</dd></div><div><dt>Documentos a vencer</dt><dd>{atual.docs_breve}</dd></div><div><dt>Preventivas vencidas</dt><dd>{atual.planos_vencidos}</dd></div><div><dt>Preventivas próximas</dt><dd>{atual.planos_breve}</dd></div></dl>
        <Link className={styles.primary} href={`/frota/${atual.id}?aba=${proximaAba}`}>{assunto[proximaAba]}<ArrowUpRight size={18} aria-hidden/></Link>
        <nav className={styles.shortcuts} aria-label="Histórico do veículo selecionado"><Link href={`/frota/${atual.id}?aba=viagens`}>Viagens</Link><Link href={`/frota/${atual.id}?aba=checklists`}>Inspeções</Link><Link href={`/frota/${atual.id}?aba=historico`}>Histórico</Link></nav>
        <p className={styles.note}>Disponibilidade, inspeção e pendências são informações distintas. A saída continua sujeita às verificações do servidor.</p>
      </aside>}</div>}
  </section>;
}
