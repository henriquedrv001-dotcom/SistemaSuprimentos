import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShareText, buildShareImagePages } from '../src/services/catalogShare.ts';
const item=(code,description='MATERIAL')=>({id:code,code,description,unit:'UN',type:'TIPO',group:'GRUPO',criterion:'Mensal',active:true,visible:true,technicalSpecification:'NOTA INTERNA',associations:[{id:'private',erpOrderNumber:'REFERÊNCIA INTERNA'}]});
const measure=text=>Array.from(text).length*9;

test('texto compartilha somente os itens fornecidos, em ordem, preservando códigos',()=>{
 const text=buildShareText([item('0002','SEGUNDO'),item('0001','PRIMEIRO')]);
 assert.ok(text.includes('2 itens'));assert.ok(text.indexOf('0002')<text.indexOf('0001'));
 for(const field of ['Unidade: UN','Critério: Mensal','Grupo: GRUPO'])assert.ok(text.includes(field));
 assert.ok(!text.includes('NOTA INTERNA'));assert.ok(!text.includes('REFERÊNCIA INTERNA'));
});

test('imagem inclui todos os selecionados sem omitir páginas',()=>{
 const items=Array.from({length:1600},(_,i)=>item(`MXM${i}`));const pages=buildShareImagePages(items,measure);
 assert.ok(pages.length>1);assert.ok(pages.every(page=>page.height<=1600));
 assert.deepEqual(pages.flatMap(page=>page.rows.map(row=>row.cells[0].join(''))),items.map(item=>item.code));
});

test('descrições muito longas são quebradas sem cortar conteúdo ou exceder a imagem',()=>{
 const description='X'.repeat(10000);const pages=buildShareImagePages([item('0001',description)],measure);
 assert.ok(pages.length>1);assert.ok(pages.every(page=>page.height<=1600));
 assert.equal(pages.flatMap(page=>page.rows.flatMap(row=>row.cells[1])).join(''),description);
});

test('lista vazia não gera páginas e singular usa item',()=>{
 assert.equal(buildShareImagePages([],measure).length,0);assert.ok(buildShareText([item('0001')]).includes('1 item\n'));
});
