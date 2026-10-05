"use client";

import { useEffect } from "react";

// Marco 3K: no celular as tabelas viram cartões (CSS). Cada célula precisa do nome da coluna ao lado do valor;
// este componente copia o título de cada coluna para a célula (data-label), em todas as tabelas da Gestão.
export function rotularTabelas(root: ParentNode) {
  for (const table of root.querySelectorAll<HTMLTableElement>("table.data-table")) {
    const titulos = [...table.querySelectorAll("thead th")].map(th => th.textContent?.trim() ?? "");
    if (!titulos.length) continue;
    for (const row of table.querySelectorAll("tbody tr, tfoot tr")) {
      let coluna = 0;
      for (const cell of row.children) {
        const titulo = titulos[coluna] ?? "";
        if (cell instanceof HTMLElement && cell.dataset.label !== titulo) cell.dataset.label = titulo;
        coluna += Number((cell as HTMLTableCellElement).colSpan) || 1;
      }
    }
  }
}

export function RotulosTabelas() {
  useEffect(() => {
    let frame = 0;
    const agendar = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => rotularTabelas(document)); };
    agendar();
    const observer = new MutationObserver(agendar);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  return null;
}
