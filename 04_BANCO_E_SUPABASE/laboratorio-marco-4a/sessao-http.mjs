// Reutiliza o HTTP 2F somente para saúde e encerramento de sessões no 4A.
// O núcleo aprovado permanece intacto; nenhum caminho v1 lê/grava eventos aqui.
import { startLabServer } from '../laboratorio-marco-2b/http-lab.mjs';
import { LabError } from '../laboratorio-marco-2b/auth-local.mjs';

export function startSessionServer({core,...options}) {
 const deny=async()=>{throw new LabError(404,'ROTA_NAO_ENCONTRADA');};
 return startLabServer({...options,core:{...core,record:deny,history:deny,outcome:deny,outcomeHistoric:deny}});
}
