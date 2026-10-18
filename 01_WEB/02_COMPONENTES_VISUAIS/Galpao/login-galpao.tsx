"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import { BrandLogo } from "../brand";
import { decidirModoLogin, lerSinaisAparelho, type ModoLogin } from "@/03_FUNCOES_E_LOGICA/Galpao/decidir-3d";
import "./steel-login.css";

type Scene = { destroy: () => void };
declare global {
  interface Window { startMetalloSteel?: (root: HTMLElement) => Scene | undefined }
}

const semAssinatura = () => () => {};
const modoNoServidor = (): ModoLogin => "simples";
const modoNoAparelho = (): ModoLogin => decidirModoLogin(lerSinaisAparelho());

// O modelo da proposta é carregado só no login e só quando o aparelho aguenta (ou a pessoa pede).
// Nenhum script acessa a sessão ou os campos do formulário.
export function LoginGalpao({ children, area, outroAcesso }: {
  children: ReactNode; area: "gestao" | "colaborador"; outroAcesso: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [pediu3d, setPediu3d] = useState(false);
  const modo = useSyncExternalStore(semAssinatura, modoNoAparelho, modoNoServidor);
  const ativo = modo === "3d" || (modo === "opcional" && pediu3d);
  useEffect(() => {
    if (!ativo) return;
    let cancelled = false, scene: Scene | undefined;
    async function load() {
      try {
        await Promise.all([
          import("./steel-roof-access.js"), import("./steel-structure.js"),
          import("./steel-renderer.js"), import("./steel-camera.js"), import("./steel-motion.js"),
        ]);
        if (!cancelled && root.current) {
          scene = window.startMetalloSteel?.(root.current);
          if (!scene) setFailed(true);
        }
      } catch { if (!cancelled) setFailed(true); }
    }
    void load();
    return () => { cancelled = true; scene?.destroy(); };
  }, [ativo]);

  return <div className={ativo ? "steel-login" : "steel-login steel-simples"} ref={root}>
    <section className="steel-visual" aria-label="Obra Plastamp da Metallo">
      <div className="steel-brand"><BrandLogo/><span className="brand-rule" aria-hidden="true"/><span className="brand-caption">Montagens<br/>industriais</span></div>
      <div className="steel-stage">
        {ativo ? <canvas aria-label="Montagem do galpão Plastamp"/> : <div className="steel-poster">
          {/* Imagem gerada do mesmo modelo 3D: obra completa vista pela frente. */}
          <Image src="/galpao-poster.webp" alt="Estrutura metálica do galpão da obra Plastamp" width={1000} height={467} unoptimized priority/>
          {modo === "opcional" && <button type="button" className="steel-opt3d" onClick={() => setPediu3d(true)}>Ver animação do galpão</button>}
        </div>}
        {failed && <p role="status">A visualização 3D não pôde carregar. Você pode continuar o acesso normalmente.</p>}
      </div>
      <div className="steel-copy"><p className="eyebrow">PRECISÃO EM CADA CONEXÃO</p><h2>Grandes estruturas.<br/><span>Conexões que sustentam.</span></h2><p>A força da nossa engenharia.<br/>A proximidade de uma equipe conectada.</p></div>
    </section>
    <button className="motion-toggle" type="button" aria-label="Pausar animação" aria-pressed="false" hidden={failed || !ativo}/>
    <section className="steel-form-section" aria-label="Acesso à Metallo"><div className="steel-loginbox">
      <p className="eyebrow">BEM-VINDO À METALLO</p><h1>Acesse seu espaço.</h1>
      <p>{area === "gestao" ? "Sua operação, equipes e materiais." : "Seus equipamentos, marcações e avisos."}</p>
      <nav className="loginroles" aria-label="Área de acesso">
        {area === "gestao" ? <><span aria-current="page">Gestão</span><a href={outroAcesso}>Funcionário</a></> : <><a href={outroAcesso}>Gestão</a><span aria-current="page">Funcionário</span></>}
      </nav>
      {children}
    </div></section>
    <footer className="steel-footer">METALLO · MONTAGENS INDUSTRIAIS</footer>
  </div>;
}
