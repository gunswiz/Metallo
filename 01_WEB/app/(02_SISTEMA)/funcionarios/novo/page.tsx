import Link from "next/link";
import { createEmployee } from "@/app/actions/operations";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { SubmitButton } from "@/02_COMPONENTES_VISUAIS/submit-button";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";

const uniformSizes = ["M", "G", "GG", "XG", "XXG"];
const shoeSizes = Array.from({ length: 9 }, (_, index) => String(index + 38));

export default async function NewEmployeePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireCapability("admin:manage");
  const service = await getMetalloService();
  const [teams, professions] = await Promise.all([service.listTeams(), service.listProfessions()]);
  const { error } = await searchParams;
  return <><PageHeader eyebrow="CADASTRO INTERNO" title="Novo funcionário" description="O cadastro não cria acesso ao sistema; ele organiza EPI, farda, ferramentas e ASO." />
    <section className="panel"><div className="panel-body">{error && <div className="alert error" role="alert">Revise os campos e as datas do ASO.</div>}<form action={createEmployee} className="form-grid">
      <label>Nome completo<input name="fullName" required maxLength={140} /></label><label>Matrícula<input name="registrationCode" maxLength={40} /></label>
      <label>Profissão<select name="profession" defaultValue="" required><option value="" disabled>Selecione</option>{professions.map((profession) => <option key={profession.code} value={profession.code}>{profession.name}</option>)}</select></label><label>Equipe<select name="teamId" defaultValue="" required><option value="" disabled>Selecione</option>{teams.filter((team) => team.location_type === "field").map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
      <label>Camisa<select name="shirtSize" defaultValue=""><option value="">Não informado</option>{uniformSizes.map((size) => <option key={size}>{size}</option>)}</select></label><label>Calça<select name="pantsSize" defaultValue=""><option value="">Não informado</option>{uniformSizes.map((size) => <option key={size}>{size}</option>)}</select></label><label>Bota<select name="shoeSize" defaultValue=""><option value="">Não informado</option>{shoeSizes.map((size) => <option key={size}>{size}</option>)}</select></label>
      <label>Data do exame ASO<input name="asoExamDate" type="date" lang="pt-BR" /></label><label>Validade do ASO<input name="asoExpiryDate" type="date" lang="pt-BR" /></label>
      <div className="form-actions"><Link className="button ghost" href="/funcionarios">Cancelar</Link><SubmitButton pendingLabel="Cadastrando…">Cadastrar funcionário</SubmitButton></div>
    </form></div></section></>;
}
