import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { z } from "zod";

const repo=vi.hoisted(()=>({choices:vi.fn(),delivery3d:vi.fn(),kitSuggestion3d:vi.fn(),awareness3i:vi.fn()}));
const navigationError=vi.hoisted(()=>new Error("redirecionamento"));
vi.mock("next/navigation",()=>({unstable_rethrow:(error:unknown)=>{if(error===navigationError)throw error;}}));
vi.mock("@/03_FUNCOES_E_LOGICA/Autenticacao/session",()=>({requireCapability:async()=>({id:"gestor",role:"admin"})}));
vi.mock("@/09_CONFIGURACOES/ambienteSupabase",()=>({getSupabaseEnv:()=>({url:"teste"})}));
vi.mock("@/09_CONFIGURACOES/ambiente-teste-online",()=>({recursosNovosLiberados:()=>true}));
vi.mock("@/04_SERVICOS/metallo-service",()=>({getMetalloService:vi.fn()}));
vi.mock("@/02_COMPONENTES_VISUAIS/obras-pedidos",()=>({SiteOperations:()=>null}));
vi.mock("@/02_COMPONENTES_VISUAIS/epi-preparacao-3d",()=>({EpiPreparacao3d:()=> <button>Preparar kit</button>}));
vi.mock("@/app/actions/epi-completo",()=>({manageEpiFeedback3d:vi.fn(),registerEpiDelivery3d:vi.fn()}));
vi.mock("@/05_ACESSO_A_DADOS/Repositorios/epi-operacoes-repository",()=>({getEpiOperations:async()=>repo}));
vi.mock("@/02_COMPONENTES_VISUAIS/formulario-operacao",()=>({OperationForm:({children,label,refreshOnComplete,completionHref}:{children:ReactNode;label:string;refreshOnComplete?:boolean;completionHref?:string})=><form data-refresh={refreshOnComplete} data-destination={completionHref}>{children}<button>{label}</button></form>}));
import Page from "@/app/(02_SISTEMA)/epis/entrega-em-lote/page";

const employee="cbcb4ef1-37c8-45b9-806d-92e4675c90ed",exchange="05d72830-d1c3-4b81-9bf8-71354b08f743";
beforeEach(()=>{
  repo.choices.mockResolvedValue({employees:[{id:employee,full_name:"Pessoa fictícia"}],items:[],batches:[]});
  repo.delivery3d.mockResolvedValue({prepared:[],approved:[],feedback:[]});
  repo.kitSuggestion3d.mockResolvedValue([]);
  repo.awareness3i.mockResolvedValue([]);
});
afterEach(()=>{cleanup();vi.clearAllMocks();});

it.each(["choices","delivery3d","kitSuggestion3d"] as const)("falha em %s não vira lista vazia nem oferece operações",async(method)=>{
  repo[method].mockRejectedValueOnce(new Error("DETALHE_INTERNO_NAO_EXIBIR"));
  render(await Page({searchParams:Promise.resolve({employee,exchange,prepared:"1"})}));
  expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível conferir os dados de EPI");
  expect(screen.getByRole("link",{name:"Tentar carregar novamente"})).toHaveAttribute("href",`/epis/entrega-em-lote?employee=${employee}&exchange=${exchange}`);
  expect(screen.queryByRole("button",{name:"Preparar kit"})).not.toBeInTheDocument();
  expect(screen.queryByText("Nenhum kit preparado no laboratório.")).not.toBeInTheDocument();
  expect(screen.queryByText(/DETALHE_INTERNO/)).not.toBeInTheDocument();
});
it("ZodError tem recuperação amigável sem expor detalhes do contrato",async()=>{
  repo.delivery3d.mockRejectedValueOnce(z.object({segredo:z.string()}).safeParse({}).error);
  render(await Page({searchParams:Promise.resolve({employee})}));
  expect(screen.getByRole("alert")).toHaveTextContent("não conseguiu validar");
  expect(screen.queryByText(/segredo|ZodError/)).not.toBeInTheDocument();
});
it("preserva redirecionamentos do framework",async()=>{
  repo.delivery3d.mockRejectedValueOnce(navigationError);
  await expect(Page({searchParams:Promise.resolve({employee})})).rejects.toBe(navigationError);
});
it("parâmetros de sucesso sozinhos não anunciam operação registrada",async()=>{
  render(await Page({searchParams:Promise.resolve({employee,delivered:"1"})}));
  expect(screen.getByRole("status")).toHaveTextContent("Consulta atualizada");
  expect(screen.queryByText(/Operação local registrada/)).not.toBeInTheDocument();
});
it("entrega e recusa atualizam a lista conservando a pessoa selecionada",async()=>{
  repo.delivery3d.mockResolvedValueOnce({approved:[],prepared:[{preparation_id:"kit",employee_name:"Pessoa",prepared_at:"2026-11-03",lines:[],delivery_group_id:null}],feedback:[{group_id:"grupo",employee_name:"Pessoa",delivered_at:"2026-11-03",feedback_status:null}]});
  render(await Page({searchParams:Promise.resolve({employee})}));
  for(const [name,anchor] of [["Registrar entrega","kits-preparados"],["Registrar recusa","confirmacoes"]]){
    const form=screen.getByRole("button",{name}).closest("form");
    expect(form).toHaveAttribute("data-refresh","true");
    expect(form).toHaveAttribute("data-destination",`/epis/entrega-em-lote?employee=${employee}#${anchor}`);
  }
});
