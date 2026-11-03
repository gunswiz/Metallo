import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { EditorModeloFrota } from "@/02_COMPONENTES_VISUAIS/Frota/editor-modelo";
import { modeloForm10g, type ItemModelo10g } from "@/03_FUNCOES_E_LOGICA/Frota/modelos-10g";

vi.mock("@/02_COMPONENTES_VISUAIS/formulario-operacao", () => ({ OperationForm: ({ children }: {children: ReactNode}) => <form>{children}</form> }));
afterEach(cleanup);
const item: ItemModelo10g = {codigo:1,nome:"Freios",etapa:"Segurança",critico:true,permite_na:false,exige_foto:false};

it("nova pergunta permanece aberta durante a digitação e guarda as regras escolhidas", () => {
  const {container}=render(<EditorModeloFrota categoria="saveiro" nome="Saveiro" revisao={1} itens={[item]} actorId="gestor" keyId="chave" action={async()=>({})}/>);
  fireEvent.click(screen.getByRole("button",{name:"Adicionar pergunta"}));
  const campo=screen.getByLabelText("Pergunta 2");
  fireEvent.change(campo,{target:{value:"Pneus"}});
  expect(campo.closest("details")).toHaveAttribute("open");
  fireEvent.click(screen.getByLabelText("Exigir foto da não conformidade — pergunta 2"));
  const payload=JSON.parse((container.querySelector('input[name="itens"]') as HTMLInputElement).value);
  expect(payload[1]).toMatchObject({nome:"Pneus",exige_foto:true});
  expect(screen.getByText(/Salvar não altera o checklist/)).toBeInTheDocument();
});

it("contrato rejeita conteúdo ilegível, códigos repetidos e categoria fora do padrão", () => {
  const form={categoria:"saveiro",nome:"Saveiro",base:"1",motivo:"Revisão de ensaio",idempotencyKey:"12345678-1234-4234-8234-123456789abc",itens:JSON.stringify([item])};
  expect(modeloForm10g.safeParse(form).success).toBe(true);
  for(const patch of [{itens:"["},{itens:JSON.stringify([item,item])},{categoria:"../outra"}]) expect(modeloForm10g.safeParse({...form,...patch}).success).toBe(false);
});
