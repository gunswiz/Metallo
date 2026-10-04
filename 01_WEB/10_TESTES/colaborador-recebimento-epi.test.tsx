// @vitest-environment-options {"url":"http://127.0.0.1:3101"}
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { EpiRecebimento } from "@/app/colaborador/[[...screen]]/epi-recebimento";
import { personalDeliveryGroups3d, portalFetch, type PersonalDeliveryGroup3d } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";
import { PasswordConfirmError } from "@/04_SERVICOS/assinatura-browser-3f";
import { marcacaoEmAndamento } from "@/03_FUNCOES_E_LOGICA/Ponto/marcacao-em-andamento";

// Marco 3J: receber EPI em telas simples. Confirmar SEMPRE exige digital ou senha.
const groupId = "72e6de19-388c-4c39-9f6c-39f0df8e1280";
const deliveryId = "a65b5104-e00c-4302-9073-f18b8747ee7f";
const deliveryId2 = "a65b5104-e00c-4302-9073-f18b8747ee80";
const groups: PersonalDeliveryGroup3d[] = [{ group_id: groupId, delivered_at: "2026-09-28T12:00:00Z",
  profession: "Soldador", feedback_status: null, feedback_at: null, public_message: null,
  items: [{ delivery_id: deliveryId, item_name: "Bota sintética",
    ca_number: "CA-3D", quantity: 1, unit: "par", variant: "42", current_status: "active" }] }];
afterEach(cleanup);

it("entrega pendente aparece no topo com duas escolhas grandes", async () => {
  render(<EpiRecebimento read={async () => groups} respond={async () => 1}/>);
  expect(await screen.findByRole("heading", { name: "Você recebeu estes EPIs?" })).toBeInTheDocument();
  expect(screen.getByText("Para fazer agora")).toBeInTheDocument();
  expect(screen.getByText(/1 par · tamanho 42 · CA 3D/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Recebi tudo" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Falta algo ou veio errado" })).toBeInTheDocument();
});

it("Recebi tudo abre tela cheia no lugar; sem digital, exige a senha e só anuncia após o servidor", async () => {
  let finish!: () => void;
  const respond = vi.fn(async () => 1);
  const confirmWithPassword = vi.fn<(groupId: string, password: string, key: string) => Promise<void>>(() => new Promise<void>(resolve => { finish = resolve; }));
  const onConfirmed = vi.fn();
  render(<EpiRecebimento read={async () => groups} respond={respond} confirmWithPassword={confirmWithPassword} onConfirmed={onConfirmed}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Recebi tudo" }));
  const sheet = screen.getByRole("dialog", { name: "Confirmar recebimento" });
  expect(within(sheet).getByText("Bota sintética")).toBeInTheDocument();
  // Enquanto a tela cheia está aberta, a volta do foco não esconde a página.
  expect(marcacaoEmAndamento()).toBe(true);
  const button = within(sheet).getByRole("button", { name: "Confirmar com a senha" });
  expect(button).toBeDisabled();
  fireEvent.change(within(sheet).getByLabelText("Digite sua senha para confirmar"), { target: { value: "senha-sintetica" } });
  fireEvent.click(button);
  await waitFor(() => expect(confirmWithPassword).toHaveBeenCalledTimes(1));
  expect(confirmWithPassword.mock.calls[0].slice(0, 2)).toEqual([groupId, "senha-sintetica"]);
  expect(respond).not.toHaveBeenCalled();
  expect(screen.queryByText("Pronto!")).not.toBeInTheDocument();
  finish();
  expect(await screen.findByText("Pronto!")).toBeInTheDocument();
  expect(screen.getByText("Recebimento confirmado com a sua senha.")).toBeInTheDocument();
  expect(onConfirmed).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "OK" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(marcacaoEmAndamento()).toBe(false);
});

it("senha errada não confirma nada e limpa o campo", async () => {
  const confirmWithPassword = vi.fn(async () => { throw new PasswordConfirmError("senha_incorreta"); });
  const onConfirmed = vi.fn();
  render(<EpiRecebimento read={async () => groups} respond={async () => 1} confirmWithPassword={confirmWithPassword} onConfirmed={onConfirmed}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Recebi tudo" }));
  const input = screen.getByLabelText("Digite sua senha para confirmar");
  fireEvent.change(input, { target: { value: "errada" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar com a senha" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Senha incorreta. Tente de novo.");
  expect(input).toHaveValue("");
  expect(screen.queryByText("Pronto!")).not.toBeInTheDocument();
  expect(onConfirmed).not.toHaveBeenCalled();
});

it("muitas tentativas erradas orientam a esperar ou usar a digital", async () => {
  const confirmWithPassword = vi.fn(async () => { throw new PasswordConfirmError("muitas_tentativas"); });
  render(<EpiRecebimento read={async () => groups} respond={async () => 1} confirmWithPassword={confirmWithPassword}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Recebi tudo" }));
  fireEvent.change(screen.getByLabelText("Digite sua senha para confirmar"), { target: { value: "x" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar com a senha" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Muitas tentativas erradas");
});

it("sem digital e sem senha disponível, não existe caminho para confirmar", async () => {
  const respond = vi.fn(async () => 1);
  render(<EpiRecebimento read={async () => groups} respond={respond}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Recebi tudo" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Confirmação indisponível neste aparelho");
  expect(screen.queryByRole("button", { name: /Confirmar/ })).not.toBeInTheDocument();
  expect(respond).not.toHaveBeenCalled();
});

it("Falta algo: um item é escolhido sozinho, basta tocar no problema; sem texto, a escolha vira a descrição", async () => {
  const respond = vi.fn(async () => 1);
  render(<EpiRecebimento read={async () => groups} respond={respond}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Falta algo ou veio errado" }));
  const send = screen.getByRole("button", { name: "Enviar para a Gestão" });
  expect(send).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Tamanho errado" }));
  expect(screen.getByRole("button", { name: "Tamanho errado" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(send);
  await waitFor(() => expect(respond).toHaveBeenCalledTimes(1));
  expect((respond.mock.calls[0] as unknown[]).slice(0, 5)).toEqual([groupId, "DIVERGENCIA", deliveryId, "TAMANHO", "Tamanho errado"]);
  expect(await screen.findByText("Aviso enviado!")).toBeInTheDocument();
});

it("Falta algo com vários itens pede o item; Outro problema exige explicação; falha offline não produz sucesso", async () => {
  const two: PersonalDeliveryGroup3d[] = [{ ...groups[0], items: [...groups[0].items,
    { delivery_id: deliveryId2, item_name: "Luva sintética", ca_number: null, quantity: 2, unit: "par", variant: null, current_status: "active" }] }];
  const respond = vi.fn(async () => { throw new Error("Failed to fetch"); });
  render(<EpiRecebimento read={async () => two} respond={respond}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Falta algo ou veio errado" }));
  const send = screen.getByRole("button", { name: "Enviar para a Gestão" });
  fireEvent.click(screen.getByRole("button", { name: "Outro problema" }));
  expect(send).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Luva sintética" }));
  expect(send).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Explique o problema"), { target: { value: " Veio só um par " } });
  expect(send).toBeEnabled();
  fireEvent.click(send);
  await waitFor(() => expect(respond).toHaveBeenCalledTimes(1));
  expect((respond.mock.calls[0] as unknown[]).slice(0, 5)).toEqual([groupId, "DIVERGENCIA", deliveryId2, "OUTRO", "Veio só um par"]);
  expect(await screen.findByRole("alert")).toHaveTextContent("Não deu certo agora");
  expect(screen.queryByText("Aviso enviado!")).not.toBeInTheDocument();
});

it("após resolução mostra o recado da Gestão e permite confirmar", async () => {
  const resolved: PersonalDeliveryGroup3d[] = [{ ...groups[0], feedback_status: "RESOLVIDA",
    feedback_at: "2026-09-29T13:00:00Z", public_message: "A Gestão revisou a entrega sintética." }];
  const confirmWithPassword = vi.fn(async () => {});
  render(<EpiRecebimento read={async () => resolved} respond={async () => 1} confirmWithPassword={confirmWithPassword}/>);
  expect(await screen.findByText("Recado da Gestão: A Gestão revisou a entrega sintética.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Recebi tudo" }));
  fireEvent.change(screen.getByLabelText("Digite sua senha para confirmar"), { target: { value: "s" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar com a senha" }));
  await waitFor(() => expect(confirmWithPassword).toHaveBeenCalledWith(groupId, "s", expect.any(String)));
});

it("divergência em análise fica visível como aguardando a Gestão, sem botões de resposta", async () => {
  const waiting: PersonalDeliveryGroup3d[] = [{ ...groups[0], feedback_status: "EM_ANALISE", feedback_at: "2026-09-29T13:00:00Z" }];
  render(<EpiRecebimento read={async () => waiting} respond={async () => 1}/>);
  expect(await screen.findByText("Aguardando a Gestão")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Recebi tudo" })).not.toBeInTheDocument();
});

it("sem nada pendente, mostra só uma linha tranquila", async () => {
  const done: PersonalDeliveryGroup3d[] = [{ ...groups[0], feedback_status: "CONFIRMADO", feedback_at: "2026-09-29T13:00:00Z" }];
  render(<EpiRecebimento read={async () => done} respond={async () => 1}/>);
  expect(await screen.findByText("Nenhuma entrega para conferir.")).toBeInTheDocument();
  expect(screen.queryByText("Bota sintética")).not.toBeInTheDocument();
});

it("parser pessoal recusa campo interno e a allowlist bloqueia escrita direta e remoto", async () => {
  expect(personalDeliveryGroups3d(groups)).toHaveLength(1);
  expect(personalDeliveryGroups3d([{ ...groups[0], feedback_status: "RESOLVIDA",
    feedback_at: "2026-09-29T13:00:00Z", public_message: "Mensagem pública" }])).toHaveLength(1);
  expect(() => personalDeliveryGroups3d([{ ...groups[0], employee_id: "outro" }])).toThrow();
  expect(() => personalDeliveryGroups3d([{ ...groups[0], internal_note: "segredo" }])).toThrow();
  expect(() => personalDeliveryGroups3d([{ ...groups[0], items: [{ ...groups[0].items[0], internal_note: "segredo" }] }])).toThrow();
  for (const url of ["http://127.0.0.1:54321/rest/v1/epi_delivery_groups_3d?select=*",
    "http://127.0.0.1:54321/rest/v1/rpc/prepare_epi_kit_3d",
    "https://example.supabase.co/rest/v1/rpc/respond_epi_delivery_3d"])
    await expect(portalFetch(url)).rejects.toThrow("Destino local não autorizado.");
});

it("recusa registrada pela Gestão aparece com o recado e o funcionário ainda pode confirmar ou avisar problema", async () => {
  const refused: PersonalDeliveryGroup3d[] = [{ ...groups[0], feedback_status: "RECUSA", feedback_at: "2026-09-28T13:00:00Z",
    public_message: "Funcionário recusou receber a bota sintética." }];
  expect(personalDeliveryGroups3d(refused)).toEqual(refused);
  render(<EpiRecebimento read={async () => refused} respond={async () => 1}/>);
  expect(await screen.findByText("Recado da Gestão: Funcionário recusou receber a bota sintética.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Recebi tudo" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Falta algo ou veio errado" })).toBeInTheDocument();
});
