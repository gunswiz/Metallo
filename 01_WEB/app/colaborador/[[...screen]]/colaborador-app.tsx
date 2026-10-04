"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/02_COMPONENTES_VISUAIS/brand";
import { ArrowLeft, ArrowRight, CircleUserRound, Menu, ShieldCheck } from "lucide-react";
import { useColaboradorSession, type PortalScreen } from "@/03_FUNCOES_E_LOGICA/Autenticacao/use-colaborador-session";
import { setSharedDevice, useAparelhoCompartilhado } from "@/03_FUNCOES_E_LOGICA/Autenticacao/aparelho-compartilhado";
import { loginDeTeste } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { MinhaObra } from "./minha-obra";
import { MeuPerfil } from "./meu-perfil";
import { MinhaEquipe } from "./minha-equipe";
import { MeuPontoOnline } from "./meu-ponto-online";
import { MeusEpis } from "./meus-epis";
import { MeusItens } from "./meus-itens";
import { MeusComunicados } from "./meus-comunicados";
import { MeusRegistros } from "./meus-registros";
import { DrawerColaborador } from "./drawer-colaborador";
import { PendenciasColaborador } from "./pendencias-colaborador";
import styles from "./colaborador.module.css";

type Screen = PortalScreen;
function firstName(name: string) { return name.trim().split(/\s+/)[0] || "Colaborador"; }

export default function ColaboradorApp({ screen, anonKey, demo = false, online = false, baseUrl }: { screen: string; anonKey: string; demo?: boolean; online?: boolean; baseUrl?: string }) {
  const router = useRouter();
  const [visualScreen, setVisualScreen] = useState<Screen | null>(null);
  const current = (demo && visualScreen ? visualScreen : screen) as Screen;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sharedChoice, setSharedChoice] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const go = useCallback((next: Screen) => {
    if (demo) setVisualScreen(next);
    else router.replace(`/colaborador/${next}`);
  }, [router, demo]);
  const { profile, loading, busy, error, login: signIn, logout, verify, readCurrentWork, readTeamSummary, readPersonalEpis, readExchangeableEpis, readExchangeRequests, createExchangeRequest, cancelExchangeRequest, readDeliveryGroups3d, respondDelivery3d, readPersonalReport3e, readPersonalItems3g, confirmPersonalItem3g, reportPersonalItem3g, readCommunications3h, openCommunication3h, readEpiAwareness3i, acceptEpiAwareness3i, getAccessToken } = useColaboradorSession(anonKey, demo, current, go, baseUrl);
  const sharedDevice = useAparelhoCompartilhado(Boolean(profile) && !demo, () => logout());
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMenuOpen(false);
    const submitted = password;
    setPassword("");
    setSharedDevice(sharedChoice);
    await signIn(online ? loginDeTeste(email) : email, submitted);
  }

  return <main className={styles.shell}>
    <div className={styles.ambient} aria-hidden="true" />
    <header className={`${styles.topbar} ${profile ? styles.appTopbar : ""}`}>
      {profile && <button ref={menuTrigger} type="button" className={styles.menuToggle} aria-label="Abrir menu" aria-controls="colaborador-menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={25}/></button>}
      <div className={styles.brand}><BrandLogo /><span className={styles.brandText}>COLABORADOR</span></div>
      <span className={styles.testBadge}>AMBIENTE DE TESTE{demo ? " · PRÉVIA VISUAL" : online ? " · ONLINE" : ""}</span>

    </header>
    {!demo && <p className={styles.modeLabel}>SIMULAÇÃO SEM VALOR OFICIAL</p>}
    {sharedDevice.shared && <p className={styles.sharedBanner} role="status">Aparelho do almoxarifado: {sharedDevice.leaving ? "registro concluído. Saindo da sua conta em instantes…" : "o portal sai sozinho depois que você confirmar ou após 2 minutos sem uso."} <button type="button" onClick={sharedDevice.leaveNow}>Sair agora</button></p>}
    {loading ? <div className={styles.loading} role="status">Verificando seu acesso…</div> : !profile ?
      <section className={styles.loginLayout}>
        <div className={styles.loginIntro}><p className={styles.eyebrow}>ACESSO PESSOAL</p><h1>Acesse suas<br/><em>informações.</em></h1><p>Consulte seu perfil, equipe e obra atual em um só lugar.</p><div className={styles.introLine}><ShieldCheck size={21}/> Acesso individual protegido</div></div>
        {demo ? <div className={styles.loginCard}><div className={styles.formIcon}><CircleUserRound size={30}/></div><h2>Prévia visual</h2><p>Explore as telas com dados sintéticos. A autenticação real não está habilitada nesta prévia.</p><button className={styles.primary} onClick={() => { window.sessionStorage.removeItem("metallo-visual-ended"); go("inicio"); }}>Abrir prévia<ArrowRight size={20}/></button><small>Sem login, ponto ou dados reais nesta prévia.</small></div> : <form className={styles.loginCard} onSubmit={login}><div className={styles.formIcon}><CircleUserRound size={30}/></div><h2>Entrar no Colaborador</h2><p>Use sua conta de teste para acessar.</p><label htmlFor="email">{online ? "Usuário" : "E-mail"}</label><input id="email" type={online ? "text" : "email"} inputMode="email" autoCapitalize="none" autoCorrect="off" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required placeholder={online ? "joao" : "seu.email@exemplo.com"}/><label htmlFor="password">Senha</label><input id="password" type="password" autoComplete={online && !sharedChoice ? "current-password" : "off"} value={password} onChange={event => setPassword(event.target.value)} required placeholder="Sua senha"/>{error && <div className={styles.error} role="alert">{error}</div>}<label className={styles.sharedChoice}><input type="checkbox" checked={sharedChoice} onChange={event => setSharedChoice(event.target.checked)}/> Aparelho do almoxarifado (sair automaticamente)</label><button className={styles.primary} type="submit" disabled={busy} aria-busy={busy}>{busy ? "Entrando…" : "Entrar"}<ArrowRight size={20}/></button><small>{online ? "Teste online com dados fictícios. O ponto aqui não tem valor oficial." : "Somente testes locais com dados fictícios. Meu Ponto não tem valor oficial."}</small></form>}
      </section> : <div className={styles.appLayout}>
        <DrawerColaborador key={profile.employee_id} open={menuOpen} onClose={() => setMenuOpen(false)} trigger={menuTrigger} profile={profile} current={current} busy={busy} logout={logout} demo={demo} go={go}/>
        <div className={styles.content}>
          {error && <div className={styles.error} role="alert">{error} <button onClick={() => void verify(current)}>Tentar novamente</button></div>}
          {current === "inicio" && <div className={styles.homeLayout}>
            <div className={styles.homeGreeting}><p className={styles.eyebrow}>METALLO COLABORADOR</p><h1>Olá, {firstName(profile.full_name)}</h1></div>
            {demo ? <p className={styles.pointWarning}>Registro de ponto indisponível nesta prévia visual.</p> : <MeuPontoOnline key={profile.employee_id} getToken={getAccessToken} employeeId={profile.employee_id} name={profile.full_name} presentation="home"/>}
            <PendenciasColaborador key={`pending-${profile.employee_id}`} items={readPersonalItems3g} deliveries={demo ? undefined : readDeliveryGroups3d} communications={readCommunications3h}/>
          </div>}
          {current !== "inicio" && current !== "login" && <>
            <Link href="/colaborador/inicio" onClick={demo ? (event) => { event.preventDefault(); go("inicio"); } : undefined} className={styles.back}><ArrowLeft size={19}/> Voltar ao início</Link>
            <div className={styles.detailHeader}><p className={styles.eyebrow}>MEU ESPAÇO</p><h1>{current === "perfil" ? "Meu Perfil" : current === "equipe" ? "Minha Equipe" : current === "epis" ? "Meus EPIs" : current === "itens" ? "Meus Itens Pessoais" : current === "comunicados" ? "Comunicados" : current === "ponto" ? "Meu Ponto" : current === "registros" ? "Meus registros" : current === "comprovantes" ? "Comprovantes" : "Obras"}</h1><p>{current === "obra" ? "Consulte a obra vinculada a você no momento." : current === "epis" ? "Confira os EPIs registrados em seu nome." : current === "itens" ? "Acompanhe entregas, confirmação e solicitações dos seus itens de trabalho." : current === "comunicados" ? "Leia os avisos destinados a você. Abrir um aviso registra apenas visualização." : current === "registros" ? "Consulte suas marcações, incluindo os últimos 60 dias." : current === "comprovantes" ? "Recibos individuais e extração das últimas 48 horas." : current === "ponto" ? "Ensaio online com dados fictícios, sem valor trabalhista." : "Informações pessoais da sua conta de teste."}</p></div>
            {current === "registros" || current === "comprovantes" ? <MeusRegistros key={`${profile.employee_id}-${current}`} getToken={getAccessToken} presentation={current === "comprovantes" ? "receipts" : "history"}/> : current === "perfil" ? <MeuPerfil key={profile.employee_id} profile={profile} demo={demo} busy={busy} go={go} logout={logout} readCurrentWork={readCurrentWork} readTeamSummary={readTeamSummary} getAccessToken={demo ? undefined : getAccessToken}/> :
              current === "equipe" ? <MinhaEquipe key={profile.employee_id} readTeamSummary={readTeamSummary}/> :
              current === "epis" ? <MeusEpis key={profile.employee_id} readEpis={readPersonalEpis}
                readReport={demo ? undefined : readPersonalReport3e}
                awareness={demo ? undefined : { read: readEpiAwareness3i, accept: acceptEpiAwareness3i }}
                receiving={demo ? undefined : {read:readDeliveryGroups3d,respond:respondDelivery3d,getAccessToken,sharedDevice:sharedDevice.shared,onConfirmed:sharedDevice.afterConfirm}}
                exchange={demo ? undefined : {readEligible:readExchangeableEpis,readRequests:readExchangeRequests,create:createExchangeRequest,cancel:cancelExchangeRequest}}/> :
              current === "itens" ? <MeusItens key={profile.employee_id} read={readPersonalItems3g}
                actions={demo ? {} : { confirm: confirmPersonalItem3g, report: reportPersonalItem3g }}/>: 
              current === "comunicados" ? <MeusComunicados key={profile.employee_id} read={readCommunications3h} open={openCommunication3h} demo={demo}/>: 
              <div className={styles.detailCard}>{current === "ponto" ? <MeuPontoOnline key={profile.employee_id} getToken={getAccessToken} employeeId={profile.employee_id} name={profile.full_name}/> : <MinhaObra key={profile.employee_id} demo={demo} readWork={readCurrentWork}/>}</div>}
          </>}
        </div>
        <footer className={styles.shellFootnote}>{online ? "SIMULAÇÃO SEM VALOR OFICIAL. Ambiente de teste online com dados fictícios, separado da produção. Não liberado para funcionários reais. Não é ponto oficial." : <>SIMULAÇÃO SEM VALOR OFICIAL. Não implantado no Supabase remoto. Não liberado para funcionários reais. Não é produção, conformidade REP-P ou autorização de ponto oficial. Não autoriza publicação.</>}</footer>
      </div>}
  </main>;
}

