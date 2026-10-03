// Copia somente fontes rastreadas do HEAD para um controle descartavel local.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '../../..');
const out = import.meta.dirname;
const control = resolve(root, '01_WEB/.auditoria-head-controle');
if (existsSync(control)) throw new Error('Controle ja existe; nao sobrescrever.');
const git = (...args) => execFileSync('git', args, {cwd:root});
const files = git('ls-tree','-r','--name-only','HEAD','01_WEB').toString().trim().split('\n');
for (const file of files) {
  const dest = resolve(control, file.slice('01_WEB/'.length));
  mkdirSync(dirname(dest), {recursive:true});
  writeFileSync(dest, git('show',`HEAD:${file}`));
}
const tsconfig = resolve(control, 'tsconfig.json');
writeFileSync(tsconfig, readFileSync(tsconfig, 'utf8').replace('../07_CONFIGURACOES_DO_PROJETO/tsconfig.base.json','../../07_CONFIGURACOES_DO_PROJETO/tsconfig.base.json'));
const affected = ['01_WEB/02_COMPONENTES_VISUAIS/obras-pedidos.tsx','01_WEB/app/actions/substituir-locado.ts','01_WEB/07_ESTILOS/globals.css','01_WEB/10_TESTES/obras-telas.test.tsx','01_WEB/10_TESTES/paridade-actions.test.ts','01_WEB/10_TESTES/typography-accessibility.test.ts'];
const hash = data => createHash('sha256').update(data).digest('hex');
writeFileSync(resolve(out,'proveniencia-web.json'), JSON.stringify({at:new Date().toISOString(),head:git('rev-parse','HEAD').toString().trim(),files:affected.map(path=>({path,head_sha256:hash(git('show',`HEAD:${path}`)),checkout_sha256:hash(readFileSync(resolve(root,path))),head_equal_normalized:git('show',`HEAD:${path}`).toString().replaceAll('\r\n','\n')===readFileSync(resolve(root,path),'utf8').replaceAll('\r\n','\n')}))},null,2));
writeFileSync(resolve(out,'gestao-diff-preexistente.patch'),git('diff','--',...affected));
console.log('Controle HEAD e evidencias criados, sem alterar fontes do checkout.');
