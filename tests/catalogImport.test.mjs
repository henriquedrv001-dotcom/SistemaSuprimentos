import test from 'node:test';
import assert from 'node:assert/strict';
import { buildImportPreview, planImportUpdates } from '../src/services/catalogImport.ts';

const item = (overrides = {}) => ({ id:'item-1', code:'00123', description:'DESCRIÇÃO LOCAL', unit:'UN', type:'TIPO LOCAL', group:'GRUPO LOCAL', criterion:'Mensal', active:false, visible:false, technicalSpecification:'Texto personalizado\nSegunda linha.', associations:[{id:'link-1',processNumber:'PDL-0030',availableBalance:0}], ...overrides });
const csv = body => 'Código;Descrição;Unidade;Tipo;Grupo;Critério\n' + body;

test('1600 existentes e 8 novos: identificação por código sem alterar a base', () => {
  const items = Array.from({length:1600},(_,i)=>item({id:`id-${i}`,code:`MXM${i}`,description:`ITEM ${i}`}));
  const original = structuredClone(items);
  const text = csv(Array.from({length:1608},(_,i)=>`MXM${i};ITEM ${i};UN;TIPO LOCAL;GRUPO LOCAL;Mensal`).join('\n'));
  const preview = buildImportPreview(text,items,'mxm.csv');
  assert.equal(preview.newItems.length,8);assert.equal(preview.unchangedCount,1600);assert.equal(preview.updates.length,0);
  assert.deepEqual(items,original);
});

test('apenas os campos escolhidos mudam; especificações, status, vínculos e id são protegidos', () => {
  const old = item();
  const preview = buildImportPreview(csv('00123;DESCRIÇÃO OFICIAL;KG;TIPO OFICIAL;GRUPO OFICIAL;Sob solicitação'),[old],'mxm.csv');
  const plan = planImportUpdates(preview,{'item-1':['description','unit']},[old]);
  assert.equal(plan.updated.length,1);assert.equal(plan.items[0].description,'DESCRIÇÃO OFICIAL');assert.equal(plan.items[0].unit,'KG');
  assert.equal(plan.items[0].type,old.type);assert.equal(plan.items[0].group,old.group);assert.equal(plan.items[0].criterion,old.criterion);
  for(const key of ['id','code','technicalSpecification','active','visible','associations'])assert.deepEqual(plan.items[0][key],old[key]);
});

test('nenhum campo selecionado significa nenhuma atualização', () => {
  const old=item();const preview=buildImportPreview(csv('00123;OFICIAL;;;;'),[old],'mxm.csv');
  assert.deepEqual(planImportUpdates(preview,{},[old]).items,[old]);
  assert.equal(planImportUpdates(preview,{},[old]).updated.length,0);
});

test('tentativa de escolher campo protegido não altera personalizações', () => {
  const old=item();const preview=buildImportPreview(csv('00123;OFICIAL;;;;'),[old],'mxm.csv');
  assert.deepEqual(planImportUpdates(preview,{'item-1':['technicalSpecification','active','associations']},[old]).items,[old]);
});

test('código duplicado no arquivo bloqueia a importação inteira', () => {
  assert.throws(()=>buildImportPreview(csv(' abc ;UM;KG;;;\nABC;DOIS;KG;;;'),[],'mxm.csv'),/Código repetido/);
});

test('código duplicado no cadastro atual também bloqueia comparação ambígua', () => {
  assert.throws(()=>buildImportPreview(csv('00123;UM;;;;'),[item(),item({id:'another',code:' 00123 '})],'mxm.csv'),/repetido no cadastro atual/);
});

test('zeros à esquerda preservados e códigos normalizados para correspondência', () => {
  const preview=buildImportPreview(csv(' 00123 ;DESCRIÇÃO LOCAL;;;;'),[item()],'mxm.csv');assert.equal(preview.unchangedCount,1);
  assert.equal(buildImportPreview(csv('000001;NOVO;KG;;;'),[],'mxm.csv').newItems[0].code,'000001');
});

test('colunas opcionais ausentes ou vazias não apagam valores existentes', () => {
  for(const text of [csv('00123;DESCRIÇÃO LOCAL;;;;'),'Código;Descrição\n00123;DESCRIÇÃO LOCAL']) {
    const preview=buildImportPreview(text,[item()],'mxm.csv');assert.equal(preview.updates.length,0);assert.equal(preview.unchangedCount,1);
  }
});

test('mudança só no Tipo é identificada corretamente', () => {
  const preview=buildImportPreview(csv('00123;DESCRIÇÃO LOCAL;;OUTRO TIPO;;'),[item()],'mxm.csv');
  assert.deepEqual(preview.updates[0].changes.map(change=>change.field),['type']);
});

test('edição posterior à prévia bloqueia sobrescrita do campo alterado', () => {
  const old=item();const preview=buildImportPreview(csv('00123;OFICIAL;;;;'),[old],'mxm.csv');
  assert.throws(()=>planImportUpdates(preview,{'item-1':['description']},[item({description:'ALTERAÇÃO RECENTE'})]),/mudou depois da prévia/);
});

test('personalização posterior em campo não selecionado é preservada', () => {
  const old=item();const preview=buildImportPreview(csv('00123;OFICIAL;;;;'),[old],'mxm.csv');
  assert.equal(planImportUpdates(preview,{'item-1':['description']},[item({technicalSpecification:'ESPECIFICAÇÃO NOVA'})]).items[0].technicalSpecification,'ESPECIFICAÇÃO NOVA');
});

test('CSV aceita aspas escapadas, delimitadores dentro de texto e múltiplas linhas', () => {
  const preview=buildImportPreview('Código;Descrição;UNID\n0001;"ITEM; COM ""ASPAS""\nSEGUNDA LINHA";KG',[],'mxm.csv');
  assert.equal(preview.newItems[0].description,'ITEM; COM "ASPAS"\nSEGUNDA LINHA');assert.equal(preview.newItems[0].unit,'KG');
});

test('CSV vírgula e TXT tabulado são aceitos', () => {
  assert.equal(buildImportPreview('Código,Descrição,Unidade\n0001,ITEM,KG',[],'mxm.csv').newItems[0].unit,'KG');
  assert.equal(buildImportPreview('Código\tDescrição\tUnidade\n0001\tITEM\tKG',[],'mxm.txt').newItems[0].unit,'KG');
});

test('dados incompletos, aspas abertas, critério desconhecido e cabeçalhos ambíguos são rejeitados', () => {
  assert.throws(()=>buildImportPreview(csv('00123;;;;;'),[],'mxm.csv'),/obrigatórios/);
  assert.throws(()=>buildImportPreview(csv('00123;"SEM FIM'),[],'mxm.csv'),/aspas sem fechamento/);
  assert.throws(()=>buildImportPreview(csv('00123;ITEM;KG;;;Inválido'),[],'mxm.csv'),/critério desconhecido/);
  assert.throws(()=>buildImportPreview('Código;Código MXM;Descrição\n1;1;ITEM',[],'mxm.csv'),/mais de uma coluna/);
});

test('itens fora da extração não são excluídos ou inativados', () => {
  const old=item();const preview=buildImportPreview(csv('00999;NOVO;KG;;;'),[old],'mxm.csv');
  assert.deepEqual(planImportUpdates(preview,{},[old]).items,[old]);assert.equal(preview.newItems.length,1);
});


test('cabeçalhos usuais de unidade preservam KG sem assumir UN', () => {
  for (const header of ['Unidade', 'UNID', 'UNID.', 'UND', 'UN', 'UM', 'Unidade de medida', 'Unid. medida', 'Unidade de movimentação']) {
    const preview=buildImportPreview(`Código;Descrição;${header}\n0001;ARROZ;Kg`,[],'mxm.csv');
    assert.equal(preview.newItems[0].unit,'KG',header);
  }
});

test('novos materiais sem coluna de unidade ou com unidade vazia são bloqueados', () => {
  assert.throws(()=>buildImportPreview('Código;Descrição\n0001;ARROZ',[],'mxm.csv'),/coluna de unidade/);
  assert.throws(()=>buildImportPreview('Código;Descrição;UNID\n0001;ARROZ;',[],'mxm.csv'),/unidade está vazia/);
});

test('correção de UN para KG só aplica a unidade escolhida e preserva personalizações', () => {
  const old=item();const preview=buildImportPreview('Código;Descrição;UNID\n00123;DESCRIÇÃO OFICIAL;KG',[old],'mxm.csv');
  assert.equal(preview.updates.length,1);assert.ok(preview.updates[0].changes.some(change=>change.field==='unit'&&change.before==='UN'&&change.after==='KG'));
  assert.equal(planImportUpdates(preview,{},[old]).items[0].unit,'UN');
  const corrected=planImportUpdates(preview,{'item-1':['unit']},[old]).items[0];
  assert.deepEqual(corrected,{...old,unit:'KG'});
});
