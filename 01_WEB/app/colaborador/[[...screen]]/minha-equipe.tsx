"use client";

import { UsersRound, WifiOff } from "lucide-react";
import type { PersonalTeam } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";
import { usePersonalDetail } from "./use-personal-detail";
import styles from "./colaborador.module.css";
import { nomeProfissao } from "@/03_FUNCOES_E_LOGICA/Cadastros/profissao";

export function MinhaEquipe({ readTeamSummary }: { readTeamSummary: () => Promise<PersonalTeam | null> }) {
  const { state, refresh } = usePersonalDetail(readTeamSummary);
  if (state.status === "loading") return <div className={styles.personalStatus} role="status">Consultando sua equipe…</div>;
  if (state.status === "error") return <div className={styles.personalStatus} role="alert"><WifiOff size={32}/><h2>Equipe indisponível</h2><p>{state.message}</p><button type="button" onClick={refresh}>Tentar novamente</button></div>;
  const team = state.data;
  if (!team) return <div className={styles.personalStatus}><UsersRound size={36}/><h2>Sem equipe atribuída no momento.</h2><p>Seu acesso ao portal continua disponível.</p></div>;
  return <div className={styles.personalLayout}>
    <section className={styles.personalCard} aria-labelledby="equipe-nome">
      <p className={styles.workLabel}>EQUIPE ATUAL</p><h2 id="equipe-nome">{team.team_name}</h2>
      <dl className={styles.personalFacts}>
        <div><dt>Situação</dt><dd>Ativa</dd></div>
        <div><dt>Obra atual</dt><dd>{team.work_name || "Sem obra atribuída no momento."}</dd></div>
        <div><dt>Responsável</dt><dd>Não cadastrado</dd></div>
        <div><dt>Integrantes</dt><dd>{team.member_count}</dd></div>
      </dl>
    </section>
    <section className={styles.personalCard} aria-labelledby="equipe-integrantes"><h2 id="equipe-integrantes">Integrantes</h2><p>Nome e função das pessoas atualmente vinculadas à sua equipe.</p>
      <ul className={styles.teamRoster}>{team.members.map((member, index) => <li key={`${member.name}-${index}`}><span className={styles.rosterAvatar} aria-hidden="true">{member.name.trim().slice(0, 1).toUpperCase()}</span><span><strong>{member.name}</strong><small>{nomeProfissao(member.profession)}</small></span></li>)}</ul>
    </section>
  </div>;
}
