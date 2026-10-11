"use client";
import { Component, Suspense, type ReactNode } from "react";
import styles from "./colaborador.module.css";

// Marco 7A: cada tela do app é baixada só quando abre (o celular antigo carrega menos de uma vez).
// Se a tela não baixar (sem internet), aparece um aviso simples em vez de travar o app.
class FalhaTela extends Component<{ children: ReactNode }, { erro: boolean }> {
  state = { erro: false };
  static getDerivedStateFromError() { return { erro: true }; }
  render() {
    if (!this.state.erro) return this.props.children;
    return <div role="alert" className={styles.espelhoAlerta}>
      <p>Não foi possível abrir esta tela agora. Confira a internet.</p>
      <button type="button" className={styles.queueButton} onClick={() => window.location.reload()}>Tentar de novo</button>
    </div>;
  }
}
export function TelaComCarga({ children }: { children: ReactNode }) {
  return <FalhaTela><Suspense fallback={<p className={styles.pointState} role="status">Abrindo…</p>}>{children}</Suspense></FalhaTela>;
}
