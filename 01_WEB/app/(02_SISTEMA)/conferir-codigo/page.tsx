import { redirect } from "next/navigation";
import { CircleCheck, CircleX } from "lucide-react";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { conferenciaLiberada3s, conferirCodigo3s } from "@/05_ACESSO_A_DADOS/Supabase/conferir-codigo-3s";

const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short" }) : "—";

// Marco 3S — Conferir o "Código de verificação" que sai no PDF de EPI: mostra de quem é a confirmação e se o conteúdo continua igual.
export default async function ConferirCodigoPage({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  await requireCapability("epi:read");
  if (!conferenciaLiberada3s()) redirect("/epis");
  const codigo = ((await searchParams).codigo ?? "").slice(0, 120);
  const r = codigo ? await conferirCodigo3s(codigo).catch(() => "erro" as const) : undefined;
  return <>
    <PageHeader eyebrow="EPI" title="Conferir código de verificação"
      description="Digite o código que aparece no PDF da ficha de EPI (64 letras e números, em grupos de 4). Serve para provar que a confirmação existe e não foi mudada." />
    <section className="panel"><div className="panel-body">
      <form method="get" className="conferir-form">
        <label>Código de verificação<textarea name="codigo" rows={3} required defaultValue={codigo} spellCheck={false} autoComplete="off"
          placeholder="Ex.: 3A9F 0C21 … (pode colar com ou sem espaços)" /></label>
        <button className="button primary" type="submit">Conferir</button>
      </form>
    </div></section>
    {r === "invalido" && <div className="alert error" role="alert">O código deve ter 64 letras (A–F) e números. Confira se copiou inteiro.</div>}
    {r === "erro" && <div className="alert error" role="alert">Não foi possível conferir agora. Tente de novo.</div>}
    {r === null && <div className="alert error" role="alert"><CircleX size={18} aria-hidden /> <strong>Código não encontrado.</strong> Nenhuma confirmação de EPI tem este código. Confira os números.</div>}
    {r && typeof r === "object" && <section className="panel conferir-resultado" aria-live="polite">
      <header className="panel-header"><div><h2>{r.integro ? <><CircleCheck size={20} aria-hidden /> Código confere</> : <><CircleX size={20} aria-hidden /> Atenção: conteúdo divergente</>}</h2>
        <p>{r.integro ? "Esta confirmação existe e o conteúdo é exatamente o mesmo do momento em que foi confirmada." : "O registro foi encontrado, mas o conteúdo não bate com o código. Avise o administrador."}</p></div></header>
      <div className="panel-body">
        <dl className="definition-grid">
          <div className="definition-item"><dt>Funcionário</dt><dd>{r.funcionario}{r.matricula ? ` · ${r.matricula}` : ""}</dd></div>
          <div className="definition-item"><dt>Confirmado com</dt><dd>{r.forma === "digital" ? "Digital (no celular dele)" : "Senha pessoal"}</dd></div>
          <div className="definition-item"><dt>Confirmado em</dt><dd>{fmt(r.confirmado_em)}</dd></div>
          <div className="definition-item"><dt>Entrega</dt><dd>{fmt(r.entregue_em)}</dd></div>
        </dl>
        <h3>Itens confirmados</h3>
        <ul className="conferir-itens">{(r.itens ?? []).map((i, n) => <li key={n}><strong>{i.quantity} {i.unit}</strong> {i.item_name}{i.ca ? ` · C.A. ${i.ca}` : ""}{i.size ? ` · tam. ${i.size}` : ""}</li>)}</ul>
        <p className="muted">Teste: sem valor jurídico definitivo (não é certificado ICP-Brasil). Conferir com o jurídico antes do uso real.</p>
      </div>
    </section>}
  </>;
}
