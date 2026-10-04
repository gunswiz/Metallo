"use client";

import { CheckCircle2, GraduationCap, HeartPulse, TriangleAlert, WifiOff } from "lucide-react";
import { dataBr5a, prazo5a, type Ficha5a } from "@/03_FUNCOES_E_LOGICA/Treinamentos/contrato-5a";
import { usePersonalDetail } from "./use-personal-detail";
import styles from "./simples.module.css";

// Marco 5A — o funcionário vê, em linguagem simples, se o ASO e os treinamentos estão em dia.
const chip: Record<string, { texto: string; classe: string }> = {
  EM_DIA: { texto: "Em dia", classe: "tagOk" }, SEM_VENCIMENTO: { texto: "Em dia", classe: "tagOk" },
  VENCE_EM_BREVE: { texto: "Vence em breve", classe: "" }, VENCIDO: { texto: "Vencido", classe: "tagBad" },
  NAO_INFORMADO: { texto: "Não informado", classe: "tagBad" },
};
const topo = {
  EM_DIA: { titulo: "Tudo em dia", texto: "Seu ASO e seus treinamentos estão válidos.", Icon: CheckCircle2, classe: "ok" },
  VENCE_EM_BREVE: { titulo: "Atenção: vence em breve", texto: "Algo vence nos próximos 30 dias. Fale com a segurança do trabalho para agendar.", Icon: TriangleAlert, classe: "wait" },
  VENCIDO: { titulo: "Vencido", texto: "Seu ASO ou um treinamento obrigatório venceu. Não faça essa atividade até regularizar. Procure a segurança do trabalho.", Icon: TriangleAlert, classe: "fail" },
  FALTANDO: { titulo: "Falta algo", texto: "Falta o ASO ou um treinamento obrigatório da sua função. Procure a segurança do trabalho.", Icon: TriangleAlert, classe: "fail" },
} as const;

export function MeusTreinamentos({ read }: { read: () => Promise<Ficha5a> }) {
  const { state, refresh } = usePersonalDetail(read);
  if (state.status === "loading") return <p className={styles.wait} role="status">Consultando seus treinamentos…</p>;
  if (state.status === "error") return <div className={styles.block} role="alert"><p><WifiOff aria-hidden="true" size={20}/> Não foi possível consultar agora.</p>
    <div className={styles.bigActions}><button type="button" className={styles.bigSoft} onClick={refresh}>Tentar de novo</button></div></div>;
  const ficha = state.data;
  const resumo = topo[ficha.situacao];
  return <div className={styles.page}>
    <p className={styles[resumo.classe]} role="status"><resumo.Icon aria-hidden="true" size={24}/><span><strong>{resumo.titulo}</strong><br/>{resumo.texto}</span></p>
    <section className={styles.block} aria-labelledby="meu-aso"><h2 id="meu-aso">Exame médico (ASO)</h2>
      <ul className={styles.rows}><li className={styles.row}><span className={styles.rowIcon}><HeartPulse aria-hidden="true" size={22}/></span>
        <div className={styles.rowText}><strong>ASO</strong><small>{ficha.aso.aso_expiry_date ? `Válido até ${dataBr5a(ficha.aso.aso_expiry_date)} · ${prazo5a(ficha.aso.aso_expiry_date)}` : "Ainda não informado pela empresa"}</small></div>
        <span className={`${styles.rowChip} ${styles[chip[ficha.aso.situacao].classe] ?? ""}`}>{chip[ficha.aso.situacao].texto}</span></li></ul>
    </section>
    <section className={styles.block} aria-labelledby="meus-treinos"><h2 id="meus-treinos">Treinamentos</h2>
      {ficha.trainings.length === 0 && ficha.missing.length === 0 ? <p>Nenhum treinamento registrado.</p> :
        <ul className={styles.rows}>
          {ficha.missing.map(item => <li key={item.type_code} className={styles.row}><span className={styles.rowIcon}><GraduationCap aria-hidden="true" size={22}/></span>
            <div className={styles.rowText}><strong>{item.nr ? `${item.nr} · ` : ""}{item.name}</strong><small>Obrigatório para a sua função</small></div>
            <span className={`${styles.rowChip} ${styles.tagBad}`}>Falta</span></li>)}
          {ficha.trainings.map(item => <li key={item.id} className={styles.row}><span className={styles.rowIcon}><GraduationCap aria-hidden="true" size={22}/></span>
            <div className={styles.rowText}><strong>{item.nr ? `${item.nr} · ` : ""}{item.name}</strong>
              <small>Feito em {dataBr5a(item.completed_on)}{item.expires_on ? ` · válido até ${dataBr5a(item.expires_on)} · ${prazo5a(item.expires_on)}` : " · sem vencimento"}</small></div>
            <span className={`${styles.rowChip} ${styles[chip[item.situacao].classe] ?? ""}`}>{chip[item.situacao].texto}</span></li>)}
        </ul>}
    </section>
    <p className={styles.small}>Quem cadastra é a empresa. Se algo estiver errado, avise a segurança do trabalho.</p>
  </div>;
}
