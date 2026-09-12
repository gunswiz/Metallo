import {writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {PDFDocument} from 'pdf-lib';
import {expect,it} from 'vitest';
import {buildIndividualEpiPdf} from '@/03_FUNCOES_E_LOGICA/Relatorios/epi-individual-pdf';
import type {EpiDeliveryReportRow} from '@/05_ACESSO_A_DADOS/Repositorios/metallo-repository';
const employee={id:'employee',full_name:'Funcionário fictício para conferência do relatório',registration_code:'TESTE-001',profession:'Soldador e montador de estruturas metálicas'};
const row:EpiDeliveryReportRow={id:'delivery',quantity:2,delivered_at:'2026-09-01T12:00:00Z',delivered_by:'admin',closed_at:null,closed_by:null,current_status:'active',delivery_reason:'initial',variant_snapshot:'Escuro / tamanho G',ca_snapshot:'12345',brand_model_snapshot:'Teste',lot_snapshot:'LOTE',note:null,epi_items:{name:'Óculos de proteção e luvas de segurança para trabalho de montagem',code:'EPI',item_kind:'epi',unit:'un'},epi_employees:employee,teams:{id:'team',name:'Equipe Teste'}};
it('gera ficha individual paginada com quantidade, C.A. e assinatura',async()=>{
 const bytes=await buildIndividualEpiPdf({employee,deliveries:Array.from({length:70},(_,i)=>({...row,id:String(i)})),generatedBy:'ADM de teste',periodLabel:'todo o histórico disponível'});
 const pdf=await PDFDocument.load(bytes);
 expect(pdf.getPageCount()).toBeGreaterThan(2);expect(pdf.getTitle()).toContain(employee.full_name);
 expect(pdf.getPages()[0].getWidth()).toBeLessThan(pdf.getPages()[0].getHeight());
 if(process.env.METALLO_PDF_OUTPUT){await mkdir(process.env.METALLO_PDF_OUTPUT,{recursive:true});await writeFile(join(process.env.METALLO_PDF_OUTPUT,'epi-individual-web-exemplo.pdf'),bytes);}
});
it('rejeita mistura de funcionários e permite ficha sem entregas',async()=>{
 await expect(buildIndividualEpiPdf({employee,deliveries:[{...row,epi_employees:{...employee,id:'other'}}],generatedBy:'Teste',periodLabel:'Todos'})).rejects.toThrow('mixed_employee_receipt');
 const pdf=await PDFDocument.load(await buildIndividualEpiPdf({employee,deliveries:[],generatedBy:'Teste',periodLabel:'Todos'}));
 expect(pdf.getPageCount()).toBe(1);
});
