import { createPublicKey, verify } from 'node:crypto';

const origin='http://127.0.0.1:54321';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class LabError extends Error { constructor(status,code,diagnostic){super(code,{cause:diagnostic?.cause});this.status=status;this.code=code;if(diagnostic)this.diagnostic={stage:diagnostic.stage,http_status:diagnostic.http_status};} }
const json64=s=>JSON.parse(Buffer.from(s,'base64url').toString('utf8'));

export function createLabAuth(anonKey,fetcher=fetch,{requireSession=false,serviceKey=null}={}){
 if(!anonKey)throw new Error('Chave pública local ausente');
 if(requireSession&&!serviceKey)throw new Error('Verificação interna de sessão indisponível');
 async function local(path,token){
  const headers={apikey:anonKey,...(token?{Authorization:`Bearer ${token}`}:{})};
  const response=await fetcher(origin+path,{headers,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});
  return response;
 }
 async function verifySigned(token){
   if(typeof token!=='string'||token.length>8192||token.split('.').length!==3)throw new LabError(401,'SESSAO_INVALIDA');
   let header,claims;
   try{header=json64(token.split('.')[0]);claims=json64(token.split('.')[1]);}catch{throw new LabError(401,'SESSAO_INVALIDA');}
   const now=Math.floor(Date.now()/1000);
   if(header.alg!=='ES256'||!header.kid||claims.iss!==`${origin}/auth/v1`||claims.aud!=='authenticated'||claims.role!=='authenticated'||!uuid.test(claims.sub??'')||!uuid.test(claims.session_id??'')||!Number.isInteger(claims.exp)||claims.exp<=now||!Number.isInteger(claims.iat)||claims.iat<=0||claims.iat>now||claims.iat>=claims.exp)throw new LabError(401,'SESSAO_INVALIDA');
   let jwks;
   let stage='jwks_fetch',httpStatus;
   try{const r=await local('/auth/v1/.well-known/jwks.json');httpStatus=r.status;if(!r.ok)throw Error('JWKS_HTTP');stage='jwks_json';jwks=await r.json();}catch(cause){throw new LabError(503,'LABORATORIO_INDISPONIVEL',{stage,http_status:httpStatus,cause});}
   const key=jwks.keys?.find(k=>k.kid===header.kid&&k.alg==='ES256'&&k.kty==='EC'&&k.crv==='P-256');
   let valid=false;
   try{valid=!!key&&verify('sha256',Buffer.from(token.split('.').slice(0,2).join('.')),{key:createPublicKey({key,format:'jwk'}),dsaEncoding:'ieee-p1363'},Buffer.from(token.split('.')[2],'base64url'));}catch{valid=false;}
   if(!valid)throw new LabError(401,'SESSAO_INVALIDA');
   return {authUserId:claims.sub,sessionId:claims.session_id,issuedAt:claims.iat};
 }
 return {
  async checkDependency(){try{return (await local('/auth/v1/health')).ok;}catch{return false;}},
  async signOut(token,scope){
   if(!requireSession||!['local','global'].includes(scope))throw Error('LOGOUT_2E_INATIVO');
   let response;
   try{response=await fetcher(origin+`/auth/v1/logout?scope=${scope}`,{method:'POST',headers:{apikey:anonKey,Authorization:`Bearer ${token}`},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});}catch{throw new LabError(503,'LABORATORIO_INDISPONIVEL');}
   if(!response.ok)throw new LabError(503,'ENCERRAMENTO_PENDENTE');
  },
  async verifyPersonal(token){
   const claims=await verifySigned(token);
   let user,profile,stage='user_fetch',httpStatus;
   try{
    const u=await local('/auth/v1/user',token);
    httpStatus=u.status;if(!u.ok)throw new LabError(401,'SESSAO_INVALIDA',{stage,http_status:httpStatus});
    stage='user_json';user=await u.json();stage='profile_fetch';httpStatus=undefined;
    const p=await fetcher(origin+'/rest/v1/rpc/my_employee_profile',{method:'POST',headers:{apikey:anonKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});
    httpStatus=p.status;if(!p.ok)throw new LabError(403,'CONTEXTO_INATIVO',{stage,http_status:httpStatus});
    stage='profile_json';profile=await p.json();
     if(requireSession){
     stage='session_fetch';httpStatus=undefined;const s=await fetcher(origin+'/rest/v1/rpc/lab_active_session_2e',{method:'POST',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'},body:JSON.stringify({p_session_id:claims.sessionId,p_auth_user_id:claims.authUserId}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});
     httpStatus=s.status;if(!s.ok)throw new LabError(503,'LABORATORIO_INDISPONIVEL',{stage,http_status:httpStatus});
     stage='session_json';if(await s.json()!==true)throw new LabError(401,'SESSAO_ENCERRADA');
    }
   }catch(e){if(e instanceof LabError)throw e;throw new LabError(503,'LABORATORIO_INDISPONIVEL',{stage,http_status:httpStatus,cause:e});}
   if(user.id!==claims.authUserId||!Array.isArray(profile)||profile.length!==1||!uuid.test(profile[0]?.employee_id??''))throw new LabError(403,'CONTEXTO_INATIVO');
   return {authUserId:claims.authUserId,employeeId:profile[0].employee_id,sessionId:claims.sessionId,issuedAt:claims.issuedAt};
  },
  verifySigned
 };
}
