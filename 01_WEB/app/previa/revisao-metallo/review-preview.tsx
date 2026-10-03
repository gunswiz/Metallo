"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { findings, modules } from "./achados";
import styles from "./review.module.css";

export function ReviewPreview() {
  const [tab, setTab] = useState("findings");
  const [onlyHigh, setOnlyHigh] = useState(false);
  const [moduleId, setModuleId] = useState("obras");
  const [compact, setCompact] = useState(false);
  const [actor, setActor] = useState("Responsável");
  const [flow, setFlow] = useState<"consume" | "receive" | null>(null);
  const [stock, setStock] = useState(60);
  const [consumed, setConsumed] = useState(0);
  const [received, setReceived] = useState(6);
  const [origin, setOrigin] = useState("order");
  const [rental, setRental] = useState("Em uso");
  const [billingClosed, setBillingClosed] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selected = modules.find((module) => module.id === moduleId)!;
  const highCount = findings.filter((finding) => finding.priority === "Alta").length;
  const unavailable = flow === "consume" ? stock === 0 : origin === "order" && received === 10;

  function changeActor(next: string) {
    setActor(next);
    if (next !== "ADM" && moduleId === "adm") setModuleId("obras");
    setFlow(null); setError("");
  }

  function record(text: string) {
    setHistory((entries) => [text, ...entries]);
    setMessage(`${text} Apenas nesta simulação; nenhum dado real foi alterado.`);
  }

  function openFlow(next: "consume" | "receive") {
    setFlow(next); setError(""); setMessage("");
  }

  function saveExample(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const quantity = Number(values.get("quantity"));
    if (!Number.isInteger(quantity) || quantity <= 0) { setError("Informe uma quantidade inteira maior que zero."); return; }
    if (flow === "consume") {
      if (quantity > stock) { setError("A quantidade ultrapassa o saldo da obra neste exemplo."); return; }
      setStock(stock - quantity); setConsumed(consumed + quantity);
      record(`${values.get("team")} consumiu ${quantity} unidades de disco de corte do estoque da Obra Cobertura. Data do fato: ${String(values.get("when")).replace("T", " ")}.`);
    } else {
      if (origin === "order" && quantity > 10 - received) { setError("Registre apenas a quantidade que falta neste pedido."); return; }
      setStock(stock + quantity);
      if (origin === "order") {
        setReceived(received + quantity);
        record(`Recebidas ${quantity} unidades no Pedido 001. Estoque e faltantes foram atualizados juntos.`);
      } else record(`Entrada sem pedido de ${quantity} unidades, identificada separadamente na simulação.`);
    }
    setFlow(null); setError("");
  }

  function resetExample() {
    setStock(60); setConsumed(0); setReceived(6); setRental("Em uso");
    setBillingClosed(false); setHistory([]); setMessage(""); setError(""); setFlow(null);
  }

  return <main className={styles.root}>
    <div className={styles.notice}><strong>Vistoria e proposta local</strong><span>Dados fictícios · sem publicação · sem testes automatizados</span></div>
    <header className={styles.heading}><div><p>METALLO · REVISÃO DA 0.10.0</p><h1>Uma função, um fluxo</h1><span>O objetivo é integrar o que já existe, preservar o histórico e reduzir caminhos que fazem a mesma coisa de formas diferentes.</span></div><Link className="button ghost" href="/previa/consumo">Prévia do Consumo</Link></header>
    <div className={styles.metrics}><div><strong>{findings.length}</strong><span>pontos encontrados no código</span></div><div><strong>{highCount}</strong><span>prioridades funcionais altas</span></div><div><strong>0</strong><span>operações reais alteradas nesta revisão</span></div></div>
    <nav className={styles.tabs} aria-label="Revisão"><button type="button" className={tab === "findings" ? styles.active : ""} onClick={() => setTab("findings")}>O que encontrei</button><button type="button" className={tab === "proposal" ? styles.active : ""} onClick={() => setTab("proposal")}>Organização proposta e simulação</button></nav>
    {tab === "findings" ? <>
      <div className={styles.sectionHeading}><div><h2>Antes de mudar os fluxos reais</h2><p>Achados por leitura do código. Os efeitos descritos são cenários a conferir na avaliação manual; não foram executadas operações para reproduzi-los.</p></div><label className={styles.check}><input type="checkbox" checked={onlyHigh} onChange={(event) => setOnlyHigh(event.target.checked)} />Somente prioridade alta</label></div>
      <div className={styles.findings}>{findings.filter((finding) => !onlyHigh || finding.priority === "Alta").map((finding) => <article key={finding.id} className={styles.finding}>
        <div className={styles.badges}><span className={finding.priority === "Alta" ? styles.high : styles.medium}>Prioridade {finding.priority.toLowerCase()}</span><span>{finding.decision}</span><small>#{finding.id}</small></div>
        <h3>{finding.title}</h3><p className={styles.path}>{finding.where}</p>
        <dl><dt>Encontrado</dt><dd>{finding.found}</dd><dt>Consequência possível</dt><dd>{finding.consequence}</dd><dt>Minha recomendação</dt><dd>{finding.proposal}</dd></dl>
        <details><summary>Referências no projeto</summary>{finding.sources.map((source) => <code key={source}>{source}</code>)}</details>
      </article>)}</div>
      <section className={styles.keep}><h2>O que faz sentido manter</h2><p>Obra e equipe têm funções diferentes. Pedido, recebimento e entrega de EPI também. O PDF individual complementa o relatório geral. Apoio temporário preserva a equipe de origem. Avisar que uma máquina não é mais necessária não é confirmar sua devolução ou o fim da cobrança.</p><strong>A recomendação é integrar essas etapas e retirar formulários duplicados, preservando os registros existentes.</strong></section>
    </> : <>
      <div className={styles.sectionHeading}><div><h2>Navegue pela organização proposta</h2><p>Este protótipo representa a proposta para web e mobile. O APK e as telas operacionais ainda não foram alterados.</p></div><button type="button" className="button ghost" onClick={() => setCompact(!compact)}>{compact ? "Ver em largura ampla" : "Ver em largura estreita"}</button></div>
      <div className={`${styles.prototype} ${compact ? styles.compact : ""}`}>
        <div className={styles.prototypeBar}><b>Metallo · demonstração</b><label>Visão de<select value={actor} onChange={(event) => changeActor(event.target.value)}><option>Responsável</option><option>ADM</option></select></label></div>
        <div className={styles.layout}>
          <nav className={styles.moduleNav} aria-label="Módulos propostos">{modules.filter((module) => actor === "ADM" || module.id !== "adm").map((module) => <button type="button" key={module.id} className={moduleId === module.id ? styles.selectedModule : ""} onClick={() => { setModuleId(module.id); setFlow(null); setError(""); }}>{module.title}</button>)}</nav>
          <section className={styles.moduleBody}>
            {moduleId === "adm" && actor !== "ADM" ? <p>Esta área continua exclusiva da ADM. Escolha outra área ao lado.</p> : <>
            <h2>{selected.title}</h2><p>{selected.purpose}</p>
            <div className={styles.comparison}><div><span>COMO ESTÁ</span><p>{selected.current}</p></div><div><span>COMO PROPONHO</span><p>{selected.move}</p></div></div>
            <p className={styles.preserved}><strong>Preservar:</strong> {selected.keep}</p>

            {["obras", "materiais", "consumo", "pedidos"].includes(moduleId) && <>
              <div className={styles.sampleCards}><div><span>Obra Cobertura · estoque único</span><strong>{stock} unidades</strong><small>Disco de corte · equipes A e B</small></div><div><span>Pedido 001 · 10 unidades</span><strong>{received} recebidas</strong><small>{10 - received} faltantes</small></div><div><span>Consumo lançado nesta simulação</span><strong>{consumed} unidades</strong><small>Com identificação da equipe</small></div></div>
              <div className={styles.actions}><button type="button" className="button primary" onClick={() => openFlow("consume")}>Registrar consumo</button><button type="button" className="button secondary" onClick={() => openFlow("receive")}>Receber itens</button></div>
              <p className={styles.hint}>Abra esses botões por Obras, Materiais ou Pedidos: o exemplo usa o mesmo formulário e o mesmo saldo.</p>
            </>}
            {moduleId === "epi" && <div className={styles.example}><h3>Ficha única do funcionário</h3><p><b>João · exemplo fictício</b><br />Equipe de origem: A · Trabalhando com: B · Obra Cobertura</p><div className={styles.exampleRow}><span>Óculos de proteção · lote da Obra Cobertura<br /><small>C.A. 12345 (ilustrativo) · 1 unidade</small></span><strong>Em uso</strong></div><p>Entregar EPI, registrar o destino do anterior e gerar a ficha individual ficam ligados a esta pessoa. Comprar para a obra não marca o EPI como entregue.</p><p className={styles.hint}>A geração de PDF não é executada neste protótipo.</p></div>}
            {moduleId === "equipamentos" && <div className={styles.example}><h3>Parafusadeira · máquina LOC-021</h3><p>Locadora de exemplo · Obra Cobertura · Equipe B</p><div className={styles.sampleCards}><div><span>Máquina / devolução</span><strong>{rental}</strong></div><div><span>Cobrança</span><strong>{billingClosed ? "Encerramento confirmado" : "A confirmar pela ADM"}</strong></div></div><div className={styles.actions}>
              {rental === "Em uso" && <button type="button" className="button primary" onClick={() => { setRental("Aguardando ADM"); record("A obra avisou que não precisa mais da máquina. A locação continua até as confirmações da ADM."); }}>Avisar que não precisamos mais</button>}
              {actor === "ADM" && rental === "Aguardando ADM" && <button type="button" className="button secondary" onClick={() => { setRental("Devolução combinada"); record("ADM registrou a devolução combinada."); }}>Registrar devolução combinada</button>}
              {actor === "ADM" && ["Aguardando ADM", "Devolução combinada"].includes(rental) && <button type="button" className="button primary" onClick={() => { setRental("Devolvida"); record("ADM confirmou a entrega à locadora e encerrou a pendência da máquina."); }}>Confirmar entrega à locadora</button>}
              {actor === "ADM" && rental === "Devolvida" && !billingClosed && <button type="button" className="button secondary" onClick={() => { setBillingClosed(true); record("ADM confirmou separadamente o fim da cobrança."); }}>Simular fim confirmado da cobrança</button>}
            </div><p className={styles.hint}>Alterne entre Responsável e ADM no topo para acompanhar as etapas. Máquina devolvida e cobrança encerrada são informações distintas.</p></div>}
            {moduleId === "adm" && <div className={styles.example}><h3>Central de pendências</h3><p>Pedido 001: {10 - received} unidades faltantes.</p><p>Máquina LOC-021: {rental}. Cobrança: {billingClosed ? "encerrada na simulação" : "a confirmar"}.</p><p>Usuários e permissões continuam separados dos cadastros de funcionários para EPI.</p></div>}
            {flow && <form key={`${flow}-${origin}`} className={styles.flowForm} onSubmit={saveExample}>
              <h3>{flow === "consume" ? "Consumo da obra" : "Receber itens"} · formulário único proposto</h3>
              <p>Disco de corte · unidade: un · estoque físico: Obra Cobertura</p>
              {flow === "consume" ? <><label>Equipe que executou o serviço<select name="team"><option>Equipe A</option><option>Equipe B</option></select></label><label>Quando aconteceu?<input type="datetime-local" name="when" required defaultValue="2026-09-12T08:30" /></label></> : <><label>Origem do recebimento<select value={origin} onChange={(event) => setOrigin(event.target.value)}><option value="order">Pedido 001 · faltam {10 - received} unidades</option><option value="direct">Entrada sem pedido</option></select></label><p className={styles.hint}>{origin === "order" ? "Ao confirmar, o mesmo lançamento atualiza os faltantes e o estoque." : "Use entrada sem pedido apenas quando a chegada não corresponde a um pedido já cadastrado."}</p></>}
              {unavailable ? <p role="status">{flow === "consume" ? "Sem saldo disponível. Registre um recebimento antes de consumir." : "Este pedido já foi recebido por completo. Para uma chegada diferente, escolha Entrada sem pedido."}</p> : <label>Quantidade em unidades<input name="quantity" type="number" required min={1} max={flow === "consume" ? stock : origin === "order" ? 10 - received : 1000} defaultValue={1} /></label>}
              {error && <p className={styles.error} role="alert">{error}</p>}
              <div className={styles.actions}><button type="button" className="button ghost" onClick={() => setFlow(null)}>Cancelar</button><button className="button primary" type="submit" disabled={unavailable}>Confirmar somente na simulação</button></div>
            </form>}
            {message && <p className={styles.message} role="status">{message}</p>}
            </>}
          </section>
        </div>
        <footer className={styles.prototypeFooter}><span>Simulação de navegação e integração. Sem gravação no banco.</span><button type="button" className="button ghost" onClick={resetExample}>Reiniciar exemplo</button></footer>
      </div>
      {history.length > 0 && <section className={styles.example}><h3>Histórico da simulação</h3><ol>{history.map((entry, index) => <li key={`${history.length - index}-${entry}`}>{entry}</li>)}</ol></section>}
    </>}
    <section className={styles.next}><h2>Ordem recomendada para as correções reais</h2><ol><li>Compatibilidade: estoque por obra, EPI por local, devolução de locados e totais do mobile.</li><li>Integração: formulários únicos, origem do recebimento, permissões e pendências.</li><li>Organização: atalhos, nomes, apoio temporário e central da ADM.</li></ol><p>Esta etapa entrega o diagnóstico e a proposta visual. As correções reais dependem da sua avaliação. Publicação e testes automatizados permanecem aguardando sua solicitação.</p></section>
  </main>;
}
