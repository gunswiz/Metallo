// Contrato de ambiente separado do cenário. Homologação é somente um perfil
// futuro vazio e bloqueado; não existe URL/credencial remota nesta rodada.
import assert from 'node:assert/strict';
export const loadEnvironments={
 LOCAL:{base_url:'http://127.0.0.1:3103',session_url:'http://127.0.0.1:3108',auth_url:'http://127.0.0.1:54321',enabled:true},
 HOMOLOGACAO:{base_url:null,session_url:null,auth_url:null,enabled:false},
};
export function loadEnvironment(name='LOCAL'){
 assert.equal(name,'LOCAL','Homologação não autorizada/configurada');
 const profile=loadEnvironments[name];
 for(const key of ['base_url','session_url','auth_url'])assert.equal(new URL(profile[key]).hostname,'127.0.0.1');
 return profile;
}
