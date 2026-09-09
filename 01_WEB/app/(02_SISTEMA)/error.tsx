"use client";

import { ErrorPanel } from "@/02_COMPONENTES_VISUAIS/error-panel";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="panel">
      <ErrorPanel message="A conexão pode ter oscilado ou sua sessão expirou." />
      <div style={{ display: "flex", justifyContent: "center", paddingBottom: 24 }}>
        <button className="button secondary" onClick={reset} type="button">Tentar novamente</button>
      </div>
    </section>
  );
}
