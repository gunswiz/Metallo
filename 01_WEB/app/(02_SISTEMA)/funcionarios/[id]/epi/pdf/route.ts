import { z } from 'zod';
import { requireCapability } from '@/03_FUNCOES_E_LOGICA/Autenticacao/session';
import { getMetalloService } from '@/04_SERVICOS/metallo-service';
import { buildIndividualEpiPdf } from '@/03_FUNCOES_E_LOGICA/Relatorios/epi-individual-pdf';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const profile=await requireCapability('epi:read');const parsed=z.uuid().safeParse((await params).id);
  if(!parsed.success)return new Response('Funcionário inválido',{status:400});
  const service=await getMetalloService();const result=await service.getEmployee(parsed.data);
  const from='2000-01-01T00:00:00.000Z',to=new Date(Date.now()+86400000).toISOString();
  const report=await service.epiReportData({from,to,employeeId:parsed.data});
  if(report.truncated)return new Response('O histórico ultrapassa o limite de geração. Solicite à ADM a emissão por período.',{status:422});
  const bytes=await buildIndividualEpiPdf({employee:result.employee,deliveries:report.deliveries,generatedBy:profile.fullName,periodLabel:'Todo o histórico disponível'});
  return new Response(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer,{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="ficha-epi-${parsed.data}.pdf"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
