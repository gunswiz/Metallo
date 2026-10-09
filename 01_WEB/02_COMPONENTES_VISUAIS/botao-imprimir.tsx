"use client";
import { Printer } from "lucide-react";

// Abre a impressão do navegador (dá para "Salvar como PDF").
export function BotaoImprimir({ rotulo = "Imprimir ou salvar PDF" }: { rotulo?: string }) {
  return <button type="button" className="button secondary nao-imprimir" onClick={() => window.print()}><Printer size={16} aria-hidden />{rotulo}</button>;
}
