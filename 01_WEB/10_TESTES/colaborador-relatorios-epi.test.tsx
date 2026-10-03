import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EpiRelatorios } from "@/app/colaborador/[[...screen]]/epi-relatorios";
import { buildEpiReport3ePdf } from "@/03_FUNCOES_E_LOGICA/Relatorios/epi-report-3e-pdf";
import type { EpiReportPayload } from "@/03_FUNCOES_E_LOGICA/Relatorios/epi-report-3e";

vi.mock("@/03_FUNCOES_E_LOGICA/Relatorios/epi-report-3e-pdf", () => ({
  buildEpiReport3ePdf: vi.fn(async () => new Uint8Array([1, 2, 3])),
  epiReportFilename: () => "ficha-atual-epi-synthetic.pdf",
}));
const payload: EpiReportPayload = {
  employee: { id: "00000000-0000-4000-8000-000000000001", name: "João Sintético", registration: null, profession: "Montador", team: null },
  report_id: "00000000-0000-4000-8000-000000000002", generated_at: "2026-09-29T12:00:00Z",
  deliveries: [], feedback: [], exchanges: [],
};
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.mocked(buildEpiReport3ePdf).mockReset(); });

it("só consulta depois de abrir e separa os filtros do histórico", async () => {
  const read = vi.fn(async () => payload);
  render(<EpiRelatorios read={read}/>);
  expect(read).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Visualizar meus relatórios" }));
  expect(await screen.findByText("Nenhum EPI atribuído no momento.")).toBeInTheDocument();
  expect(screen.queryByLabelText("Período")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Documento"), { target: { value: "history" } });
  expect(screen.getByLabelText("Período")).toBeInTheDocument();
  expect(screen.getByText("Nenhum evento de EPI encontrado no período selecionado.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Período"), { target: { value: "custom" } });
  fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-09-30" } });
  fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2026-09-01" } });
  expect(screen.getByRole("alert")).toHaveTextContent("Confira as datas");
  expect(screen.queryByRole("button", { name: "Baixar meu histórico em PDF" })).not.toBeInTheDocument();
});

it("offline não reutiliza o preview para produzir documento atual", async () => {
  const read = vi.fn().mockResolvedValueOnce(payload).mockRejectedValueOnce(new Error("offline"));
  render(<EpiRelatorios read={read}/>);
  fireEvent.click(screen.getByRole("button", { name: "Visualizar meus relatórios" }));
  fireEvent.click(await screen.findByRole("button", { name: "Baixar minha ficha em PDF" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível gerar o relatório agora");
  expect(buildEpiReport3ePdf).not.toHaveBeenCalled();
});

it("prévia impressa mostra fornecimento e mantém todos os filtros de data sem workflow", async () => {
  const sample = structuredClone(payload);
  const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  sample.deliveries = [{ id: uuid(10), item_id: uuid(11), group_id: uuid(12), item_name: "Luva sintética",
    ca: "CA-9", quantity: 2, unit: "par", delivered_at: "2026-09-15T12:00:00Z", reason: "initial", status: "active",
    closed_at: null, variant: "M", lot: "LOTE-INTERNO", brand: "Marca interna", legacy_name: false, legacy_unit: false,
    team: null, work: null, exchange_request_id: null, employee_name_snapshot: "João Sintético",
    profession_snapshot: "Montador", responsible_id: uuid(13), responsible_name_snapshot: null }];
  sample.feedback = [{ id: 1, group_id: uuid(12), delivery_id: uuid(10), type: "DIVERGENCIA", category: "TAMANHO", at: "2026-09-16T12:00:00Z" }];
  render(<EpiRelatorios read={async () => sample}/>);
  fireEvent.click(screen.getByRole("button", { name: "Visualizar meus relatórios" }));
  expect(await screen.findByText("Luva sintética")).toBeInTheDocument();
  expect(screen.getByText(/2 pares/)).toBeInTheDocument();
  expect(screen.getByText(/CA: 9/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Documento"), { target: { value: "history" } });
  expect(screen.getByText("ENTREGA")).toBeInTheDocument();
  expect(screen.queryByText("Divergência informada")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Tipo de evento")).not.toBeInTheDocument();
  expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(expect.arrayContaining([
    "Todo o histórico", "Hoje", "Esta semana", "Este mês", "Últimos 30 dias", "Este ano", "Datas informadas",
  ]));
  fireEvent.change(screen.getByLabelText("Período"), { target: { value: "custom" } });
  fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-09-16" } });
  fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2026-09-16" } });
  expect(screen.queryByText("ENTREGA")).not.toBeInTheDocument();
  expect(sample.feedback).toHaveLength(1);
  expect(sample.deliveries[0].lot).toBe("LOTE-INTERNO");
  expect(sample.deliveries[0].ca).toBe("CA-9");
});

it("StrictMode conserva download válido e revoga a URL ao encerrar a tela", async () => {
  const create = vi.fn(() => "blob:synthetic");
  const revoke = vi.fn();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) })));
  vi.mocked(buildEpiReport3ePdf).mockResolvedValue(new Uint8Array([1, 2, 3]));
  const view = render(<StrictMode><EpiRelatorios read={async () => payload}/></StrictMode>);
  fireEvent.click(screen.getByRole("button", { name: "Visualizar meus relatórios" }));
  fireEvent.click(await screen.findByRole("button", { name: "Baixar minha ficha em PDF" }));
  await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
  expect(create).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(revoke).toHaveBeenCalledWith("blob:synthetic");
});

it("troca de conta durante geração descarta o PDF anterior", async () => {
  let finish!: (bytes: Uint8Array) => void;
  vi.mocked(buildEpiReport3ePdf).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) })));
  const create = vi.fn(() => "blob:old-account");
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
  const view = render(<EpiRelatorios key="joao" read={async () => payload}/>);
  fireEvent.click(screen.getByRole("button", { name: "Visualizar meus relatórios" }));
  fireEvent.click(await screen.findByRole("button", { name: "Baixar minha ficha em PDF" }));
  await waitFor(() => expect(buildEpiReport3ePdf).toHaveBeenCalledTimes(1));
  view.rerender(<EpiRelatorios key="maria" read={async () => ({ ...payload, employee: { ...payload.employee, name: "Maria Sintética" } })}/>);
  await act(async () => { finish(new Uint8Array([1, 2, 3])); });
  expect(create).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Visualizar meus relatórios" })).toBeInTheDocument();
  expect(screen.queryByText("Nenhum EPI atribuído no momento.")).not.toBeInTheDocument();
});
