import { LockKeyhole } from "lucide-react";
import { AVISO_LGPD, VERSAO_AVISO_LGPD } from "@/03_FUNCOES_E_LOGICA/Privacidade/aviso-lgpd";
import styles from "./colaborador.module.css";

// Marco 3S — Aviso de privacidade (LGPD) no app do funcionário, em linguagem simples.
export function Privacidade() {
  return <section className={styles.records} aria-labelledby="privacidade-title">
    <div className={styles.recordsHeading}><LockKeyhole size={25} aria-hidden/><div><h2 id="privacidade-title">Seus dados no Metallo</h2><p>O que usamos, para quê e quais são seus direitos.</p></div></div>
    <div className={styles.privacidade}>{AVISO_LGPD.map(s => <section key={s.titulo}><h3>{s.titulo}</h3><ul>{s.itens.map(i => <li key={i}>{i}</li>)}</ul></section>)}</div>
    <p className={styles.signatureNote}>Versão {VERSAO_AVISO_LGPD}. Texto de teste, ainda em revisão pela empresa.</p>
  </section>;
}
