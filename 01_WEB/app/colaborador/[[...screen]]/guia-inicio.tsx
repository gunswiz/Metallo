"use client";
import { useEffect, useState } from "react";
import { CircleHelp } from "lucide-react";
import styles from "./colaborador.module.css";

// Marco 8A: no Início, um convite para o guia até a pessoa dizer que já sabe usar (fica guardado só neste celular).
const CHAVE = "metallo-guia-visto";
export function GuiaInicio({ abrir }: { abrir: () => void }) {
  const [mostrar, setMostrar] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => { try { setMostrar(window.localStorage.getItem(CHAVE) !== "1"); } catch { setMostrar(true); } }, 0);
    return () => clearTimeout(t);
  }, []);
  function jaSei() { try { window.localStorage.setItem(CHAVE, "1"); } catch { /* sem armazenamento: só esconde agora */ } setMostrar(false); }
  if (!mostrar) return null;
  return <section className={styles.avisosCard} aria-label="Como usar o app">
    <div className={styles.avisosTopo}><CircleHelp size={24} aria-hidden/><div><h2>Primeira vez no app?</h2>
      <p>Veja como bater o ponto e ver os avisos. Leva 2 minutos e dá para ouvir a explicação.</p></div></div>
    <div className={styles.avisosBotoes}>
      <button type="button" className={styles.primary} onClick={abrir}>Ver como usar</button>
      <button type="button" className={styles.queueButton} onClick={jaSei}>Já sei usar</button>
    </div>
  </section>;
}
