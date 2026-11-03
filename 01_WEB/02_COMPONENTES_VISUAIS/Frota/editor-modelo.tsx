"use client";

import { useState } from "react";
import { OperationForm, type OperationAction } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
import { ETAPAS_MODELO_10G, type ItemModelo10g } from "@/03_FUNCOES_E_LOGICA/Frota/modelos-10g";

export function EditorModeloFrota({ categoria, nome, revisao, itens: inicial, actorId, keyId, action }: {
  categoria: string; nome: string; revisao: number; itens: ItemModelo10g[]; actorId: string; keyId: string; action: OperationAction;
}) {
  const [itens, setItens] = useState(inicial);
  const [abertos, setAbertos] = useState(() => new Set(inicial.filter(i => !i.nome).map(i => i.codigo)));
  const atualizar = (codigo: number, patch: Partial<ItemModelo10g>) => setItens(lista => lista.map(i => i.codigo === codigo ? { ...i, ...patch } : i));
  function adicionar() {
    const codigo = Array.from({ length: 99 }, (_, i) => i + 1).find(c => !itens.some(i => i.codigo === c));
    if (!codigo || itens.length >= 60) return;
    setAbertos(lista => new Set(lista).add(codigo));
    setItens(lista => [...lista, { codigo, nome: "", etapa: "Segurança", critico: true, permite_na: false, exige_foto: false }]);
  }
  return <OperationForm action={action} label="Salvar revisão do rascunho" pendingLabel="Salvando revisão…"
    operationKeyScope={`metallo:frota:modelo:${actorId}:${categoria || "nova"}:${revisao}`} initialOperationKey={keyId}
    newOperationLabel="Iniciar outra tentativa de revisão" refreshOnComplete>
    {categoria ? <><input type="hidden" name="categoria" value={categoria}/><input type="hidden" name="nome" value={nome}/></> : <>
      <label>Código da categoria<input name="categoria" required minLength={2} maxLength={30} pattern="[a-z][a-z0-9_]{1,29}" placeholder="ex.: utilitario"/></label>
      <label>Nome da categoria<input name="nome" required minLength={2} maxLength={60} placeholder="ex.: Veículo utilitário"/></label>
    </>}
    <input type="hidden" name="base" value={revisao}/><input type="hidden" name="itens" value={JSON.stringify(itens)}/>
    <div className="full"><p>{itens.length} perguntas · revisão {revisao ? `${revisao} será preservada` : "inicial"}</p>
      <p>Estas regras são propostas. Salvar não altera o checklist dos motoristas nem libera veículos.</p>
      <div className="fleet-checklist-config">{itens.map((item, index) => <details className="stock-card fleet-item-editor" key={item.codigo} open={abertos.has(item.codigo)} onToggle={e => { const aberto = e.currentTarget.open; setAbertos(lista => { if (lista.has(item.codigo) === aberto) return lista; const nova = new Set(lista); if (aberto) nova.add(item.codigo); else nova.delete(item.codigo); return nova; }); }}>
        <summary><span><strong>{index + 1}. {item.nome || "Nova pergunta"}</strong><small>{item.etapa} · código {item.codigo}{item.critico ? " · bloqueio proposto" : ""}</small></span><span>Revisar</span></summary>
        <label>Pergunta {item.codigo}<input value={item.nome} onChange={e => atualizar(item.codigo, { nome: e.target.value })} required minLength={2} maxLength={80}/></label>
        <label>Etapa da pergunta {item.codigo}<select value={item.etapa} onChange={e => atualizar(item.codigo, { etapa: e.target.value as ItemModelo10g["etapa"] })}>{ETAPAS_MODELO_10G.map(etapa => <option key={etapa}>{etapa}</option>)}</select></label>
        <label><input type="checkbox" checked={item.critico} onChange={e => atualizar(item.codigo, { critico: e.target.checked })}/> Bloquear operação se não conforme — pergunta {item.codigo}</label>
        <label><input type="checkbox" checked={item.permite_na} onChange={e => atualizar(item.codigo, { permite_na: e.target.checked })}/> Permitir “Não se aplica” — pergunta {item.codigo}</label>
        <label><input type="checkbox" checked={item.exige_foto} onChange={e => atualizar(item.codigo, { exige_foto: e.target.checked })}/> Exigir foto da não conformidade — pergunta {item.codigo}</label>
        <button type="button" className="button secondary" onClick={() => setItens(lista => lista.filter(i => i.codigo !== item.codigo))} disabled={itens.length === 1}>Retirar pergunta {item.codigo} deste rascunho</button>
      </details>)}</div>
      <button type="button" className="button secondary" onClick={adicionar} disabled={itens.length >= 60}>Adicionar pergunta</button>
    </div>
    <label className="full">Motivo desta revisão<textarea name="motivo" required minLength={5} maxLength={300} rows={2} placeholder="Descreva o que foi revisado e o que ainda precisa da decisão do engenheiro."/></label>
  </OperationForm>;
}
