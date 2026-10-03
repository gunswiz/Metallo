# Marco 4B — auditoria adversarial, ciclo {CYCLE} de no máximo 2

SIMULAÇÃO SEM VALOR OFICIAL. Você é auditor independente somente leitura.

Inspecione o ZIP sanitizado anexado, confira seu manifesto/hashes e liste o que
realmente conseguiu ler. Não invente execução independente dos testes.

Permitido: comandos PASSIVOS no seu ambiente para listar, extrair ZIP, abrir,
pesquisar texto, comparar e calcular hashes. Proibido executar o projeto,
scripts, testes, SQL, migrations, Auth, endpoints, containers, carga ou rede
do laboratório; modificar arquivos ou acessar o Supabase remoto.

Escopo: Home, shell/drawer, navegação/foco, pendências, marcações do dia,
filtro pessoal 60 dias/páginas de 20, recibo PDF individual e ZIP móvel 48h,
logout/revogação/isolamento e ausência de fallback remoto. Examine também
as fronteiras 4A/2F preservadas das quais esses contratos dependem.

Obrigatório revisar a METODOLOGIA E EVIDÊNCIA da carga local:

- 50 auth.uid, employee, identidade, sessão e JWT distintos; cinco sem equipe;
- barreira de disparo e concorrência observada versus laços sequenciais;
- dataset inicial declarado: 1.100 registros históricos fabricados no bootstrap
  do núcleo NOVO, não são gravações HTTP nem dados da baseline;
- gravações novas HTTP, begin/marking_at servidor, commit/recorded_at, retry
  da MESMA intenção e resposta pós-commit descartada; não houve falha física;
- paginação real de duas páginas por pessoa e janela civil de 60 dias;
- 50 PDFs/50 ZIPs simultâneos e parser independente do gerador, conteúdo
  associado ao evento/titular no banco; ausência de nome legal histórico é
  explícita, não deve ser preenchida com nome atual;
- carga mista: marcar, consultar, paginar, PDF, ZIP, logout/login, revogação,
  manipulação employee_id/marking_id/receipt_id/intention_id/UUID/query/filtro;
- métricas integrais e erros/timeouts/4xx/5xx, inclusive erros ESPERADOS de
  ataques e revogação separados dos problemas de disponibilidade;
- integridade pós-carga: intenções confirmadas versus eventos duráveis, recibos
  correspondentes, originais inalterados, zero duplicação/perda/cross-user;
- evidência de revogação sob carga: requisições em andamento versus iniciadas
  após confirmação da revogação; não exigir nem alegar janela instantânea;
- CPU/RAM/conexões/limites do host. Um writer PGlite SERIALIZADO é declarado;
  concorrência HTTP não prova transações paralelas ou writers distribuídos;
- serviços descartáveis loopback 3103/3107/3108 usam os mesmos handlers; TCP
  3103 conserva Host contratual 127.0.0.1:3101. A prévia 3101/3105/3106 fica
  intacta. Opção de porta aceita apenas 3106/3107, jamais host remoto;
- procure falsa aprovação por HTTP 200, perda mascarada por retry, órfãos,
  PDF/ZIP cruzado, cardinalidade incorreta, cache/estado global, colisão de
  arquivos, starvation/deadlock, saturação/pool e cenários não comprovados.

Ataque as fronteiras auth.uid sem IDs cliente, JWT válido mas sessão revogada,
revogação durante leitura/geração, autorização APÓS PDF/ZIP, RLS/grants e
SECURITY DEFINER dependentes; João→Maria e Maria→João; conta sem equipe;
admin Gestão sem acesso pessoal indevido; troca de conta/resposta tardia;
cache/no-store, download direto, expiração/refresh/logout. Verifique se a
reorganização visual alterou intenção/GPS/idempotência/commit.

O recibo sintético não é REP-P, NSR, PAdES, ICP-Brasil, jornada ou identificação
legal completa. Cópias baixadas não são revogáveis. A janela final autorização
→bytes e o controle do host por administrador são riscos declarados. Não
converter esses limites conhecidos de produção em vulnerabilidade local
confirmada sem um caminho que viole o contrato atual.

Exija evidência para cada conclusão. Entregue achados numerados com:
ID, severidade, status CONFIRMADO/PARCIAL/HIPÓTESE/LACUNA DE EVIDÊNCIA/RISCO
FUTURO, arquivo/linha ou cenário, condição necessária, caminho de falha,
evidência, impacto, correção mínima e teste de aceitação/confiança.

Separe crítico/alto confirmado e aberto de hipótese e risco futuro. Diga
explicitamente se a carga e a integridade obrigatória de 50 foram comprovadas
nas condições declaradas, e o que não pode ser concluído. Não extrapole
capacidade de produção, não declare fechamento nem peça execução do projeto.

O Work confrontará cada achado como VALID/PARTIAL/INVALID/NOT VERIFIABLE.
Nenhuma baseline 4B, publicação ou Marco 4C está autorizada.
