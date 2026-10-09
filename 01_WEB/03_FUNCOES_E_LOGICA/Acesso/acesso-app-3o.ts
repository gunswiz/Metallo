import { z } from "zod";

// Marco 3O: contrato da tela "Acesso ao app" (Gestão cria e cuida do login do funcionário).
export const funcionarioAcesso3o = z.object({
  employee_id: z.uuid(), nome: z.string(), matricula: z.string().nullable(), equipe: z.string().nullable(),
  situacao: z.enum(["sem_acesso", "ativo", "bloqueado"]), usuario: z.string().nullable(),
  criado_em: z.string().nullable(), ultimo_acesso: z.string().nullable(),
});
export type FuncionarioAcesso3o = z.infer<typeof funcionarioAcesso3o>;
export const listaAcesso3o = z.object({ ok: z.literal(true), funcionarios: z.array(funcionarioAcesso3o) });

export const errosAcesso3o: Record<string, string> = {
  usuario_invalido: "Usuário só pode ter letras sem acento, números e ponto (3 a 30), começando por letra. Ex.: joao.silva",
  senha_curta: "A senha precisa ter pelo menos 8 caracteres.",
  senha_igual_usuario: "A senha não pode conter o nome de usuário.",
  usuario_em_uso: "Esse usuário já existe. Escolha outro (ex.: acrescente o sobrenome).",
  ja_tem_acesso: "Esse funcionário já tem acesso ativo.",
  sem_acesso: "Esse funcionário não tem acesso ativo.",
  funcionario_inativo: "Funcionário não encontrado ou inativo.",
  matricula_obrigatoria: "Cadastre a matrícula do funcionário antes de criar o acesso.",
  admin_required: "Só administrador pode mexer no acesso ao app.",
  falha: "Não foi possível concluir agora. Tente de novo.",
};

// Sugestão de usuário a partir do nome: primeiro e último nome, sem acento. Ex.: "João Teste da Silva" -> "joao.silva".
export function sugerirUsuario3o(nome: string) {
  const partes = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z\s]/g, " ")
    .split(/\s+/).filter(parte => parte.length > 1 && !["da", "de", "do", "das", "dos", "e"].includes(parte));
  if (!partes.length) return "";
  const sugestao = partes.length > 1 ? `${partes[0]}.${partes[partes.length - 1]}` : partes[0];
  return sugestao.slice(0, 30);
}

// Senha sugerida fácil de ditar: 8 números, sem repetir o mesmo dígito em sequência longa.
export function sugerirSenha3o(aleatorio: (max: number) => number) {
  let senha = "";
  while (senha.length < 8) {
    const digito = String(aleatorio(10));
    if (senha.endsWith(digito.repeat(2))) continue;
    senha += digito;
  }
  return senha;
}
