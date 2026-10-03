// @vitest-environment-options {"url":"http://127.0.0.1:3101"}
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EpiRecebimento } from "@/app/colaborador/[[...screen]]/epi-recebimento";
import { personalDeliveryGroups3d, portalFetch, type PersonalDeliveryGroup3d } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";

const groupId = "72e6de19-388c-4c39-9f6c-39f0df8e1280";
const deliveryId = "a65b5104-e00c-4302-9073-f18b8747ee7f";
const groups: PersonalDeliveryGroup3d[] = [{ group_id: groupId, delivered_at: "2026-09-28T12:00:00Z",
  profession: "Soldador", feedback_status: null, feedback_at: null, public_message: null,
  items: [{ delivery_id: deliveryId, item_name: "Bota sintética",
    ca_number: "CA-3D", quantity: 1, unit: "par", variant: "42", current_status: "active" }] }];
afterEach(cleanup);

it("exibe entrega e confirmação pendente antes de qualquer manifestação", async () => {
  render(<EpiRecebimento read={async () => groups} respond={async () => 1}/>);
  expect(await screen.findByText("Confirmação pendente")).toBeInTheDocument();
  expect(screen.getByText(/Bota sintética · 1 par · tamanho\/variante 42 · CA CA-3D/)).toBeInTheDocument();
});

it("exige revisão dos itens e só anuncia confirmação após resposta real", async () => {
  let finish!: (id: number) => void;
  const respond = vi.fn((actualGroupId: string, actualAction: string) => {
    expect(actualGroupId).toBe(groupId); expect(actualAction).toBe("CONFIRMADO");
    return new Promise<number>(resolve => { finish = resolve; });
  });
  render(<EpiRecebimento read={async () => groups} respond={respond}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar recebimento" }));
  expect(screen.getByRole("button", { name: "Confirmar recebimento" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));
  await waitFor(() => expect(respond).toHaveBeenCalledTimes(1));
  expect(respond.mock.calls[0][0]).toBe(groupId);
  expect(respond.mock.calls[0][1]).toBe("CONFIRMADO");
  expect(screen.queryByText("Recebimento confirmado no laboratório.")).not.toBeInTheDocument();
  finish(1);
  expect(await screen.findByText("Recebimento confirmado no laboratório.")).toBeInTheDocument();
});

it("divergência exige item, categoria e descrição; falha offline não produz sucesso", async () => {
  const respond = vi.fn(async () => { throw new Error("Failed to fetch"); });
  render(<EpiRecebimento read={async () => groups} respond={respond}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Informar divergência" }));
  expect(screen.getByRole("button", { name: "Enviar divergência" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Item da divergência"), { target: { value: deliveryId } });
  fireEvent.change(screen.getByLabelText("O que aconteceu?"), { target: { value: "TAMANHO" } });
  fireEvent.change(screen.getByLabelText("Descreva a divergência"), { target: { value: "Recebi tamanho 41" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar divergência" }));
  await waitFor(() => expect(respond).toHaveBeenCalledTimes(1));
  expect(respond.mock.calls[0].slice(0,5)).toEqual([groupId,"DIVERGENCIA",deliveryId,"TAMANHO","Recebi tamanho 41"]);
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível concluir agora");
  expect(screen.queryByText("Divergência informada à Gestão.")).not.toBeInTheDocument();
});

it("após resolução mostra mensagem e horário público e permite confirmar", async () => {
  const resolved: PersonalDeliveryGroup3d[] = [{ ...groups[0], feedback_status: "RESOLVIDA",
    feedback_at: "2026-09-29T13:00:00Z", public_message: "A Gestão revisou a entrega sintética." }];
  const respond = vi.fn(async () => 1);
  render(<EpiRecebimento read={async () => resolved} respond={respond}/>);
  expect(await screen.findByText("Divergência resolvida")).toBeInTheDocument();
  expect(screen.getByText(/Manifestação registrada em/)).toBeInTheDocument();
  expect(screen.getByText("Mensagem da Gestão: A Gestão revisou a entrega sintética.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));
  await waitFor(() => expect(respond).toHaveBeenCalledWith(groupId, "CONFIRMADO", null, null, null, expect.any(String)));
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

it("recusa registrada pela Gestão aparece com a mensagem e o funcionário ainda pode confirmar", async () => {
  const refused: PersonalDeliveryGroup3d[] = [{ ...groups[0], feedback_status: "RECUSA", feedback_at: "2026-09-28T13:00:00Z",
    public_message: "Funcionário recusou receber a bota sintética." }];
  expect(personalDeliveryGroups3d(refused)).toEqual(refused);
  render(<EpiRecebimento read={async () => refused} respond={async () => 1}/>);
  expect(await screen.findByText(/Recusa registrada pela Gestão/)).toBeInTheDocument();
  expect(screen.getByText("Mensagem da Gestão: Funcionário recusou receber a bota sintética.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Confirmar recebimento" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Informar divergência" })).toBeInTheDocument();
});
