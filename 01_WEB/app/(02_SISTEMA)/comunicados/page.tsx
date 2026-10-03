import { randomUUID } from "node:crypto";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { SubmitButton } from "@/02_COMPONENTES_VISUAIS/submit-button";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { readAdminCommunications3h, readCommunicationTargets3h } from "@/05_ACESSO_A_DADOS/Supabase/comunicados-3h";
import { archiveCommunication3h, publishCommunication3h } from "@/app/actions/comunicados-3h";
import { CommunicationForm3h } from "./communication-form";
import styles from "./comunicados.module.css";

function date(value: string | null) { return value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—"; }
export default async function CommunicationsPage({ searchParams }: {
  searchParams: Promise<{ page?: string; error?: string; ok?: string }>;
}) {
  await requireCapability("admin:manage");
  const query = await searchParams;
  const page = Math.max(1, Math.min(500, Number.parseInt(query.page ?? "1", 10) || 1));
  const [items, targets] = await Promise.all([readAdminCommunications3h(page), readCommunicationTargets3h()]);
  const { teams, works } = targets;
  return <>
    <PageHeader eyebrow="COMUNICAÇÃO INTERNA · LABORATÓRIO" title="Comunicados" description="Publique avisos simples para todos, uma equipe ou uma obra. Abertura registrada não é assinatura nem concordância." />
    {query.error && <div role="alert" className="alert error">Não foi possível concluir a operação. Confira os campos, a expiração e a versão atual.</div>}
    {query.ok && <div role="status" className="alert success">Comunicado atualizado.</div>}
    <section className="panel"><div className="panel-body"><details open className={styles.newNotice}><summary>Novo comunicado</summary><p>Use texto simples, sem HTML, e evite dados pessoais sensíveis.</p>
      <CommunicationForm3h teams={teams} works={works} idempotencyKey={randomUUID()} />
    </details></div></section>
    <section className="panel"><div className="panel-body"><h2>Comunicados criados</h2><p>Destinatários e visualizações refletem o vínculo atual. O histórico técnico de aberturas é preservado.</p>
      {!items.length ? <p>Nenhum comunicado nesta página.</p> : <div className={styles.list}>{items.map(item => <article className={styles.item} key={item.id}>
        <div className={styles.itemHead}><div><strong>{item.title}</strong><p>{item.audience_name ?? "Público indisponível"} · {item.status === "DRAFT" ? "Rascunho" : item.status === "ARCHIVED" ? "Arquivado" : "Publicado"}{item.pinned ? " · Fixado" : ""}</p></div><span>v{item.version}</span></div>
        <dl className={styles.stats}><div><dt>Publicado</dt><dd>{date(item.published_at)}</dd></div><div><dt>Expira</dt><dd>{date(item.expires_at)}</dd></div><div><dt>{item.status === "PUBLISHED" ? "Destinatários atuais" : "Público potencial atual"}</dt><dd>{item.recipient_count}</dd></div><div><dt>Visualizaram</dt><dd>{item.viewed_count}</dd></div>{item.status === "PUBLISHED" && <div><dt>Ainda não visualizaram</dt><dd>{Math.max(0, item.recipient_count - item.viewed_count)}</dd></div>}</dl>
        {item.updated_at && <p className={styles.meta}>Atualizado em {date(item.updated_at)}</p>}
        {item.status !== "ARCHIVED" && <div className={styles.itemActions}>
          {item.status === "DRAFT" && <form action={publishCommunication3h}><input type="hidden" name="id" value={item.id}/><input type="hidden" name="version" value={item.version}/><SubmitButton>Publicar</SubmitButton></form>}
          <form action={archiveCommunication3h}><input type="hidden" name="id" value={item.id}/><input type="hidden" name="version" value={item.version}/><SubmitButton className="button secondary">Arquivar</SubmitButton></form>
        </div>}
        {item.status !== "ARCHIVED" && <details className={styles.revise}><summary>Corrigir comunicado</summary><CommunicationForm3h teams={teams} works={works} item={item} idempotencyKey={randomUUID()}/></details>}
      </article>)}</div>}
      <nav className={styles.pagination} aria-label="Páginas de comunicados">
        {page > 1 && <a href={`/comunicados?page=${page - 1}`}>Anterior</a>}
        <span>Página {page}</span>
        {items.length === 20 && <a href={`/comunicados?page=${page + 1}`}>Próxima</a>}
      </nav>
    </div></section>
  </>;
}
