"use client";

import { useActionState, useState } from "react";
import { saveCommunication3h } from "@/app/actions/comunicados-3h";
import { communicationExpiryLocal3h, type AdminCommunication3h, type CommunicationSaveState3h } from "@/03_FUNCOES_E_LOGICA/Comunicados/contrato-3h";
import styles from "./comunicados.module.css";

type Choice = { id: string; name: string };
export function CommunicationForm3h({ teams, works, item, idempotencyKey }: {
  teams: Choice[]; works: Choice[]; item?: AdminCommunication3h; idempotencyKey: string;
}) {
  const [audience, setAudience] = useState(item?.audience ?? "ALL");
  const [title, setTitle] = useState(item?.title ?? "");
  const [message, setMessage] = useState(item?.message ?? "");
  const [teamId, setTeamId] = useState(item?.team_id ?? "");
  const [workId, setWorkId] = useState(item?.work_id ?? "");
  const [expiresAt, setExpiresAt] = useState(item?.expires_at ? communicationExpiryLocal3h(item.expires_at) : "");
  const [pinned, setPinned] = useState(item?.pinned ?? false);
  const [intentKey] = useState(idempotencyKey);
  const [state, formAction, pending] = useActionState<CommunicationSaveState3h, FormData>(saveCommunication3h, { error: null });
  const fixedAudience = item?.status === "PUBLISHED";
  const publico = audience === "TEAM" ? (teams.find(team => team.id === teamId)?.name ?? "uma equipe") : audience === "WORK" ? (works.find(work => work.id === workId)?.name ?? "uma obra") : "Todos os funcionários";
  return <div className={styles.editor}><form action={formAction} className={styles.form} aria-busy={pending}>
    <input type="hidden" name="id" value={item?.id ?? ""} />
    <input type="hidden" name="expectedVersion" value={item?.version ?? ""} />
    <input type="hidden" name="idempotencyKey" value={intentKey} />
    <label>Título <input name="title" maxLength={120} required value={title} onChange={event => setTitle(event.target.value)} placeholder="Ex.: Reunião de segurança" /></label>
    <label>Mensagem <textarea name="message" maxLength={4000} required rows={6} value={message} onChange={event => setMessage(event.target.value)} placeholder="Escreva uma mensagem clara, sem dados pessoais sensíveis." /></label>
    <div className={styles.fields}>
      <label>Público
        <select name="audience" value={audience} onChange={event => setAudience(event.target.value as "ALL" | "TEAM" | "WORK")} disabled={fixedAudience}>
          <option value="ALL">Todos os funcionários</option><option value="TEAM">Equipe específica</option><option value="WORK">Obra específica</option>
        </select>
        {fixedAudience && <input type="hidden" name="audience" value={audience} />}
      </label>
      {audience === "TEAM" && <label>Equipe
        <select name="teamId" value={teamId} onChange={event => setTeamId(event.target.value)} required disabled={fixedAudience}>
          <option value="">Selecione</option>{teams.map(team => <option value={team.id} key={team.id}>{team.name}</option>)}
        </select>
        {fixedAudience && <input type="hidden" name="teamId" value={item?.team_id ?? ""} />}
      </label>}
      {audience === "WORK" && <label>Obra
        <select name="workId" value={workId} onChange={event => setWorkId(event.target.value)} required disabled={fixedAudience}>
          <option value="">Selecione</option>{works.map(work => <option value={work.id} key={work.id}>{work.name}</option>)}
        </select>
        {fixedAudience && <input type="hidden" name="workId" value={item?.work_id ?? ""} />}
      </label>}
      <label>Expira em (Fortaleza, opcional)
        <input name="expiresAt" type="datetime-local" step="any" value={expiresAt} onChange={event => setExpiresAt(event.target.value)}/>
      </label>
    </div>
    <label className={styles.check}><input type="checkbox" name="pinned" checked={pinned} onChange={event => setPinned(event.target.checked)} /><span>Fixar no topo <small>(aparece primeiro para o funcionário)</small></span></label>
    <div className={styles.actions}>
      <button className="button secondary" type="submit" name="intent" value="draft" disabled={pending}>{pending ? "Processando…" : item ? "Salvar correção" : "Salvar rascunho"}</button>
      {(!item || item.status === "DRAFT") && <button className="button primary" type="submit" name="intent" value="publish" disabled={pending}>{pending ? "Processando…" : "Publicar comunicado"}</button>}
    </div>
    {state.error && <p role="alert" aria-live="polite" className="alert error">{state.error}</p>}
    {fixedAudience && <p className={styles.hint}>O público de um comunicado publicado não muda. Correções ficam registradas em revisão.</p>}
  </form>
  <aside className={styles.preview} aria-label="Prévia de como o funcionário vê no app">
    <span className={styles.previewLabel}>Como o funcionário vê no app</span>
    <div className={styles.phone}>
      <div className={styles.phoneTop}>Avisos</div>
      <article className={styles.notice}>
        {pinned && <span className={styles.pin}>Fixado</span>}
        <strong>{title.trim() || "Título do comunicado"}</strong>
        <p>{message.trim() || "A mensagem aparece aqui, do jeito que você escrever."}</p>
        <small>Para: {publico}{expiresAt ? ` · até ${expiresAt.slice(8, 10)}/${expiresAt.slice(5, 7)}` : ""}</small>
      </article>
    </div>
  </aside></div>;
}
