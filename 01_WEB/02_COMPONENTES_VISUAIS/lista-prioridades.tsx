"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, ChevronDown } from "lucide-react";

export type Prioridade = { id: string; titulo: string; descricao: string; href: string; quantidade?: number; urgente?: boolean };

/** Uma leitura curta, com acesso explícito a todas as pendências. */
export function ListaPrioridades({ itens, titulo = "Precisa de você", limite = 3 }: { itens: Prioridade[]; titulo?: string; limite?: number }) {
  const [todos, setTodos] = useState(false);
  const ordenados = [...itens].sort((a, b) => Number(Boolean(b.urgente)) - Number(Boolean(a.urgente)));
  const visiveis = todos ? ordenados : ordenados.slice(0, limite);
  return <section className="panel priority-panel" id="pendencias" aria-label={titulo}>
    <header className="panel-header"><div><h2>{titulo}</h2><p>{itens.length ? `${itens.length} ${itens.length === 1 ? "assunto para acompanhar" : "assuntos para acompanhar"}` : "Nenhuma pendência no momento"}</p></div>
      {itens.some(i => i.urgente) && <span className="status-badge bad">Atenção prioritária</span>}</header>
    {itens.length ? <ul className="priority-list">{visiveis.map(i => <li key={i.id}>
      <Link href={i.href} className={i.urgente ? "priority-link urgent" : "priority-link"}>
        <span className="priority-number">{i.quantidade ?? "!"}</span><span className="priority-copy"><strong>{i.titulo}</strong><small>{i.descricao}</small></span><ArrowUpRight size={18} aria-hidden/>
      </Link></li>)}</ul> : <div className="priority-empty"><CheckCircle2 size={22} aria-hidden/><strong>Tudo em dia</strong></div>}
    {itens.length > limite && <button type="button" className="priority-more" aria-expanded={todos} onClick={() => setTodos(!todos)}>
      {todos ? "Mostrar menos" : `Ver todos os ${itens.length} assuntos`}<ChevronDown size={17} aria-hidden style={{ transform: todos ? "rotate(180deg)" : undefined }}/>
    </button>}
  </section>;
}
