"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Truck, Search, ClipboardCheck, MapPin } from "lucide-react";
import { ROTULO_RESULTADO_10A, ROTULO_SITUACAO_FROTA_10A, type PainelGestao10a } from "@/03_FUNCOES_E_LOGICA/Frota/contrato-10a";

const filtros = [{ id: "todos", nome: "Todos" }, { id: "disponivel", nome: "Disponíveis" }, { id: "em_uso", nome: "Na rua" }, { id: "atencao", nome: "Atenção" }, { id: "inativos", nome: "Desativados" }] as const;
const atencao = (v: PainelGestao10a) => v.situacao === "nao_liberado" || v.situacao === "manutencao" || v.docs_vencidos + v.docs_breve + v.planos_vencidos + v.planos_breve + v.manutencoes_abertas > 0 || !v.checklist_hoje || v.checklist_hoje !== "liberado";
const pertence = (v: PainelGestao10a, filtro: string) => filtro === "inativos" ? !v.ativo : v.ativo && (filtro === "todos" || (filtro === "atencao" ? atencao(v) : v.situacao === filtro));
const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function PainelFrota({ frota }: { frota: PainelGestao10a[] }) {
  const [filtro, setFiltro] = useState<string>("todos"), [busca, setBusca] = useState("");
  const visiveis = frota.filter(v => pertence(v, filtro) && normalizar(`${v.nome} ${v.placa} ${v.modelo ?? ""} ${v.motorista ?? ""}`).includes(normalizar(busca)));
  return <section className="fleet-panel" aria-label="Caminhões da frota">
    <div className="fleet-toolbar"><div><h2>Sua frota</h2><p>Escolha um caminhão para acompanhar ou agir.</p></div>
      <label className="fleet-search"><Search size={18} aria-hidden/><input type="search" aria-label="Buscar caminhão, placa ou motorista" placeholder="Nome, placa ou motorista" value={busca} onChange={e => setBusca(e.target.value)}/></label></div>
    <div className="fleet-filters" role="group" aria-label="Filtrar caminhões">{filtros.map(f => <button type="button" key={f.id} aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>{f.nome}<span>{frota.filter(v => pertence(v, f.id)).length}</span></button>)}</div>
    <p className="fleet-results" role="status">{visiveis.length} {visiveis.length === 1 ? "caminhão encontrado" : "caminhões encontrados"}</p>
    {visiveis.length === 0 ? <div className="fleet-empty"><Truck size={30} aria-hidden/><h3>{frota.length ? "Nenhum caminhão neste filtro" : "Sua frota começa aqui"}</h3><p>{frota.length ? "Tente outra placa, nome ou situação." : "Os caminhões cadastrados aparecerão aqui."}</p>{frota.length > 0 && <button type="button" className="button secondary" onClick={() => { setBusca(""); setFiltro("todos"); }}>Limpar filtros</button>}</div> :
      <div className="fleet-grid">{visiveis.map(v => {
        const tom = !v.ativo ? "" : v.situacao === "disponivel" ? "good" : v.situacao === "em_uso" ? "warn" : "bad";
        const pendencias = v.manutencoes_abertas + v.docs_vencidos + v.docs_breve + v.planos_vencidos + v.planos_breve;
        return <article className="fleet-card" key={v.id}>
          <div className="fleet-card-head"><span className="fleet-icon"><Truck size={26} aria-hidden/></span><span className={`status-badge ${tom}`}>{v.ativo ? ROTULO_SITUACAO_FROTA_10A[v.situacao] : "Desativado"}</span></div>
          <h3><Link href={`/frota/${v.id}`}>{v.nome}</Link></h3><p className="fleet-identity"><span>{v.placa}</span>{v.modelo ?? "Caminhão munck"}{v.ano ? ` · ${v.ano}` : ""}</p>
          <div className="fleet-reading"><span>Quilometragem</span><strong>{v.km_atual.toLocaleString("pt-BR")} <small>km</small></strong></div>
          {v.situacao === "em_uso" && v.ativo && <div className="fleet-trip"><MapPin size={17} aria-hidden/><div><strong>{v.destino || "Destino não informado"}</strong><small>Com {v.motorista || "motorista não informado"}</small>{v.acompanhantes && <small>Acompanhantes: {v.acompanhantes}</small>}</div></div>}
          <div className="fleet-check" data-result={v.checklist_hoje ?? "pendente"}><ClipboardCheck size={18} aria-hidden/><span>Checklist de hoje<strong>{v.checklist_hoje ? ROTULO_RESULTADO_10A[v.checklist_hoje] : "Pendente"}</strong></span></div>
          <div className="fleet-card-foot"><span className={pendencias ? "fleet-warning" : "muted"}>{pendencias ? `${pendencias} ${pendencias === 1 ? "pendência" : "pendências"} de manutenção/documentos` : "Sem pendências de manutenção/documentos"}</span><Link href={`/frota/${v.id}`} className="button secondary">Abrir ficha<ArrowUpRight size={17} aria-hidden/></Link></div>
        </article>;
      })}</div>}
  </section>;
}
