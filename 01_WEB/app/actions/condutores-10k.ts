"use server";

import { executeValidated } from "@/03_FUNCOES_E_LOGICA/executarOperacaoValidada";
import { cnhForm10k } from "@/03_FUNCOES_E_LOGICA/Frota/condutores-10k";
import { requireFrota10a } from "@/05_ACESSO_A_DADOS/Supabase/frota-10a";

export async function salvarCnh10k(_previous: unknown, formData: FormData) {
  return executeValidated({ schema: cnhForm10k, capability: "epi:write", formData,
    paths: ["/frota/condutores"], completionKey: d => d.idempotencyKey,
    destination: d => `/frota/condutores?funcionario=${d.employeeId}`,
    operation: (client, d) => {
      requireFrota10a();
      return client.rpc("admin_salvar_cnh_10k" as never, { p_employee: d.employeeId, p_base: d.base,
        p_categoria: d.categoria, p_validade: d.validade, p_situacao: d.situacao,
        p_referencia: d.referencia, p_motivo: d.motivo, p_key: d.idempotencyKey } as never);
    },
  });
}
