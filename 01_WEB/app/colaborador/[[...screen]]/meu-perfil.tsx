"use client";

import { useCallback } from "react";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Clock3, HardHat, LogOut, ShieldCheck, UsersRound, WifiOff } from "lucide-react";
import type { PortalScreen } from "@/03_FUNCOES_E_LOGICA/Autenticacao/use-colaborador-session";
import type { PersonalProfile, PersonalTeam, PersonalWork } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";
import { usePersonalDetail } from "./use-personal-detail";
import { AssinaturaSeguranca3f } from "./assinatura-seguranca-3f";
import styles from "./colaborador.module.css";

export function MeuPerfil({ profile, demo, busy, go, logout, readCurrentWork, readTeamSummary, getAccessToken }: {
  profile: PersonalProfile; demo: boolean; busy: boolean; go: (screen: PortalScreen) => void;
  logout: (scope?: "current" | "global") => Promise<void>;
  readCurrentWork: () => Promise<PersonalWork | null>;
  readTeamSummary: () => Promise<PersonalTeam | null>;
  getAccessToken?: () => Promise<string>;
}) {
  const read = useCallback(async () => {
    const [work, team] = await Promise.all([readCurrentWork(), readTeamSummary()]);
    if ((team?.work_name ?? null) !== (work?.work_name ?? null)) throw new Error("Leituras pessoais divergentes.");
    return { work, team };
  }, [readCurrentWork, readTeamSummary]);
  const { state, refresh } = usePersonalDetail(read);
  if (state.status === "loading") return <div className={styles.personalStatus} role="status">Consultando seu perfil…</div>;
  if (state.status === "error") return <div className={styles.personalStatus} role="alert"><WifiOff size={32}/><h2>Perfil indisponível</h2><p>{state.message}</p><button type="button" onClick={refresh}>Tentar novamente</button></div>;
  const { work, team } = state.data;
  const initial = profile.full_name.trim().slice(0, 1).toUpperCase();
  const previewLink = (screen: PortalScreen) => demo ? (event: React.MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); go(screen); } : undefined;
  return <div className={styles.personalLayout}>
    <section className={styles.personalCard} aria-labelledby="perfil-identidade">
      <div className={styles.personalIdentity}><span className={styles.personalAvatar} aria-hidden="true">{initial}</span><div><p className={styles.workLabel}>MEU PERFIL</p><h2 id="perfil-identidade">{profile.full_name}</h2><p>{profile.profession?.trim() || "Função não informada"}</p></div></div>
      <dl className={styles.personalFacts}>
        <div><dt>Equipe atual</dt><dd>{team?.team_name || "Sem equipe atribuída"}</dd></div>
        <div><dt>Obra atual</dt><dd>{work?.work_name || "Sem obra atribuída no momento."}</dd></div>
        <div><dt>Acesso ao portal</dt><dd><span className={styles.accessActive}><ShieldCheck size={18}/> Acesso ativo</span></dd></div>
      </dl>
    </section>
    <section className={styles.personalCard} aria-labelledby="perfil-atalhos"><h2 id="perfil-atalhos">Acesso rápido</h2><div className={styles.personalShortcuts}>
      <Link href="/colaborador/obra" onClick={previewLink("obra")}><BriefcaseBusiness size={21}/><span>Obras</span><ArrowRight size={18}/></Link>
      <Link href="/colaborador/equipe" onClick={previewLink("equipe")}><UsersRound size={21}/><span>Minha Equipe</span><ArrowRight size={18}/></Link>
      <Link href="/colaborador/epis" onClick={previewLink("epis")}><HardHat size={21}/><span>Meus EPIs</span><ArrowRight size={18}/></Link>
      {demo ? <div className={styles.personalPending}><Clock3 size={21}/><span>Meu Ponto</span><small>Em breve</small></div> : <Link href="/colaborador/ponto"><Clock3 size={21}/><span>Meu Ponto · simulação</span><ArrowRight size={18}/></Link>}
    </div></section>
    <section id="perfil-seguranca" className={styles.personalCard} aria-labelledby="perfil-seguranca-heading"><h2 id="perfil-seguranca-heading">Segurança da conta</h2><p>Encerre esta sessão ou saia de todos os dispositivos de teste.</p><div className={styles.personalActions}>
      <button type="button" disabled={busy} onClick={() => void logout()}><LogOut size={18}/> Sair</button>
      <button type="button" disabled={busy} onClick={() => void logout("global")}><LogOut size={18}/> Sair de todos os dispositivos</button>
    </div>{getAccessToken ? <AssinaturaSeguranca3f getToken={getAccessToken}/> :
      <div className={styles.signatureBox}><p className={styles.workLabel}>SEGURANÇA · OPCIONAL</p><h3>Assinatura de recebimento</h3><p>Não configurada. Adicione uma verificação pessoal às suas confirmações de recebimento de EPI.</p><button type="button" disabled>Ativar proteção na prévia funcional</button></div>}</section>
  </div>;
}
