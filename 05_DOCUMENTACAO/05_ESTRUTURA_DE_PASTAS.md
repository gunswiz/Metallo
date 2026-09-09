# Estrutura de pastas

```text
Metallo/
├── 01_WEB/
│   ├── app/                         Telas e páginas (nome do Next.js)
│   ├── 02_COMPONENTES_VISUAIS/
│   ├── 03_FUNCOES_E_LOGICA/
│   ├── 04_SERVICOS/
│   ├── 05_ACESSO_A_DADOS/
│   ├── 07_ESTILOS/
│   ├── public/                      Imagens e ícones
│   ├── 09_CONFIGURACOES/
│   └── 10_TESTES/
├── 02_MOBILE/
│   ├── lib/                         Código do aplicativo
│   │   ├── 01_TELAS/
│   │   ├── 02_COMPONENTES/
│   │   ├── 03_NAVEGACAO/
│   │   ├── 04_FUNCOES_E_LOGICA/
│   │   ├── 06_ACESSO_A_DADOS/
│   │   ├── 07_TIPOS_E_MODELOS/
│   │   ├── 08_ESTILOS/
│   │   └── 10_CONFIGURACOES/
│   ├── assets/                      Imagens e ícones
│   ├── android/                     Construção do aplicativo Android
│   └── test/                        Testes do aplicativo
├── 03_COMPARTILHADO/
│   ├── 01_TIPOS/
│   ├── 02_VALIDACOES/
│   └── 03_REGRAS_E_PERMISSOES/
├── 04_BANCO_E_SUPABASE/supabase/
│   ├── migrations/                  Histórico de alterações do banco
│   └── functions/                   Funções executadas no servidor
├── 05_DOCUMENTACAO/
├── 06_TESTES_E_QUALIDADE/
├── 07_CONFIGURACOES_DO_PROJETO/
└── LEIA-ME-PRIMEIRO.md
```

## Para que serve cada área?

- **01_WEB:** tudo que pertence ao site. `app` contém páginas; componentes são peças visuais reaproveitadas; funções fazem cálculos e autenticação; serviços coordenam operações; acesso a dados consulta o Supabase; estilos controlam cores e medidas; `public` guarda imagens; testes conferem comportamento.
- **02_MOBILE:** tudo que pertence ao aplicativo. Dentro de `lib`, as telas estão separadas por assunto; componentes são botões, avisos e outras peças; navegação liga as telas; funções validam e formatam informações; acesso a dados conversa com o banco; modelos descrevem as informações; estilos definem a aparência; configurações definem a conexão. `main.dart` inicia o aplicativo e `app.dart` monta sua estrutura.
- **03_COMPARTILHADO:** pacotes TypeScript reutilizáveis, atualmente consumidos pelo Web. Tipos descrevem dados, validações conferem entradas e regras/permissões controlam ações. O Mobile usa seus próprios arquivos Dart, sem duplicação nova.
- **04_BANCO_E_SUPABASE:** arquivos locais do banco e funções do servidor, com histórico intacto.
- **05_DOCUMENTACAO:** guias simples e referências técnicas anteriores.
- **06_TESTES_E_QUALIDADE:** orientações e relatório da conferência geral. Os testes específicos continuam junto das aplicações.
- **07_CONFIGURACOES_DO_PROJETO:** configuração geral do TypeScript e explicação das configurações mantidas nos locais exigidos.

A numeração tem intervalos porque criamos apenas áreas com conteúdo real. `app`, `public`, `lib`, `android`, `test` e os nomes dos arquivos de ferramentas foram preservados quando apropriado. Não há cópias paralelas das telas.
