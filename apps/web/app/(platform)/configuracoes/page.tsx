import { ShieldCheck, Smartphone, Webhook } from "lucide-react";
import { roleLabels } from "@metallo/core";
import { PageHeader } from "@/components/page-header";
import { requireCapability } from "@/lib/auth/session";

export default async function SettingsPage() {
  await requireCapability("admin:manage");
  return (
    <>
      <PageHeader eyebrow="PLATAFORMA" title="Configurações" description="Estado das integrações e regras compartilhadas do ambiente Metallo." />
      <section className="content-grid">
        <div className="panel"><header className="panel-header"><div><h2>Matriz de acesso</h2><p>O frontend complementa — nunca substitui — as políticas RLS</p></div></header><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Papel</th><th>Operação</th><th>EPI</th><th>Administração</th></tr></thead><tbody>
          {Object.entries(roleLabels).map(([role, label]) => <tr key={role}><td className="primary-cell">{label}</td><td>{role === "collaborator" ? "Consulta" : "Permitida conforme equipe"}</td><td>{role === "admin" || role === "engineer" ? "Permitido" : "Sem acesso"}</td><td>{role === "admin" ? "Permitido" : "Sem acesso"}</td></tr>)}
        </tbody></table></div></div>
        <div className="panel"><header className="panel-header"><h2>Integrações</h2></header><div className="panel-body list">
          <div className="list-row"><span className="list-row-icon"><ShieldCheck size={17} /></span><span className="list-row-main"><strong>Supabase Auth + RLS</strong><span>Uma sessão e um conjunto de políticas</span></span><span className="status-badge good">Ativo</span></div>
          <div className="list-row"><span className="list-row-icon"><Smartphone size={17} /></span><span className="list-row-main"><strong>Metallo Mobile</strong><span>Mesmo projeto e histórico</span></span><span className="status-badge good">Integrado</span></div>
          <div className="list-row"><span className="list-row-icon"><Webhook size={17} /></span><span className="list-row-main"><strong>Realtime seletivo</strong><span>Tabelas operacionais, com atualização agrupada</span></span><span className="status-badge good">Ativo</span></div>
        </div></div>
      </section>
    </>
  );
}
