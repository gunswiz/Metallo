"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/client";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { TESTE_ONLINE_SUPABASE_URL } from "@/09_CONFIGURACOES/ambiente-teste-online";

export function ComprovanteOs({ ordem, veiculo }: { ordem: number; veiculo: number }) {
  const router = useRouter();
  const ocupado = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState("");
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupado.current || getSupabaseEnv().url !== TESTE_ONLINE_SUPABASE_URL) return;
    const form = evento.currentTarget;
    const dados = new FormData(form);
    const arquivo = dados.get("arquivo");
    if (!(arquivo instanceof File) || !arquivo.size || arquivo.size > 6 * 1024 * 1024) {
      setAviso("Escolha uma imagem JPEG ou PNG de até 6 MB."); return;
    }
    dados.set("acao", "comprovar_reparo");
    dados.set("ordem_id", String(ordem));
    dados.set("veiculo_id", String(veiculo));
    ocupado.current = true;
    setEnviando(true);
    setAviso("");
    try {
      const { data, error } = await createClient().functions.invoke("fotos-frota-10b", { body: dados });
      if (error || data?.ok !== true) throw new Error();
      form.reset();
      setAviso("Foto anexada à ordem de serviço.");
      router.refresh();
    } catch {
      setAviso("Não foi possível confirmar a foto. Confira o formato e tente novamente com a mesma imagem.");
    } finally {
      ocupado.current = false;
      setEnviando(false);
    }
  }
  return <form onSubmit={enviar}>
    <label>Foto do reparo da OS {ordem} (JPEG ou PNG, até 6 MB)<input name="arquivo" type="file" accept="image/jpeg,image/png" required/></label>
    <button type="submit" className="button" disabled={enviando}>{enviando ? "Anexando…" : `Anexar à OS ${ordem}`}</button>
    {aviso && <p role="status">{aviso}</p>}
  </form>;
}
