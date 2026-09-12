import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateAccess} from '../04_BANCO_E_SUPABASE/supabase/functions/create-employee/permissions.ts';
test('cadastro conserva compatibilidade e permite retirar todas as operações',()=>{
  assert.deepEqual(validateAccess({}),{operation_permissions:null,operation_team_ids:null});
  assert.deepEqual(validateAccess({operation_permissions:[]}),{operation_permissions:[],operation_team_ids:null});
});
test('cadastro rejeita permissões e equipes adulteradas',()=>{
  for(const body of [{operation_permissions:['admin:manage']},{operation_permissions:'epi:write'},{operation_team_ids:['not-uuid']},{operation_team_ids:[null]}])assert.throws(()=>validateAccess(body),/invalid_permissions/);
  assert.deepEqual(validateAccess({operation_permissions:['epi:write','epi:write']}),{operation_permissions:['epi:write'],operation_team_ids:null});
});
