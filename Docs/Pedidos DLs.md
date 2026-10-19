# Pedidos DLs — preparação

## Implementado nesta etapa

Em Pedidos → Estoque → Pedidos DLs é possível criar, consultar, editar e excluir rascunhos locais. A edição usa a área principal, sem lateral. A listagem tem busca por material, código, DL, fornecedor, MXM ou solicitante; filtros por DL e fornecedor; ordenação por atualização ou criação. A seleção de origens usa os modelos compartilhados de filtros e checkbox, com 30 materiais por página e seleção preservada entre páginas.

Cada linha referencia o ID da DL e o ID da origem contratada. Quantidades usam milésimos da unidade, até três casas decimais; preços vêm da origem, sem edição. Não misturar origens do mesmo material. O total usa arredondamento em centavos por linha. Solicitante recebe sugestão editável do nome padrão; ciclo e entrega são opcionais. As datas de vigência das origens ficam disponíveis na seleção.

Rascunhos não são pedidos enviados e não recebem numeração oficial PDL. Podem reunir diferentes origens e fornecedores para preparação; a regra de agrupamento para emissão ainda precisa ser confirmada. Rascunhos não reservam, baixam, recebem ou liberam saldo, não alteram DLs nem geram tarefas.

## Persistência e proteções

Chave separada `suprimentos:dl-order-drafts:v1`, no navegador atual. Falha de leitura bloqueia gravação, preservando o conteúdo original. A gravação compara a versão bruta lida com a chave atual para impedir sobrescrita de alterações de outra aba. Falhas de armazenamento mantêm o editor aberto. A confirmação de saída protege alterações não salvas. Antes de salvar, as origens liberadas são relidas; quantidades precisam ser positivas e não superar o disponível da origem. Isso não garante disponibilidade futura: rascunhos não comprometem saldo. Não há compartilhamento entre usuários ou integração com o MXM.

## Definições pendentes para execução

- Um fornecedor por pedido emitido ou múltiplos; separação automática de rascunhos, se aplicável.
- Perfis que solicitam, aprovam e registram envio; estados e transições.
- Quando reservar e quando baixar; regras de cancelamento, entrega parcial e não entrega.
- Numeração, vínculo obrigatório ou opcional com ciclo e tratamento de vigência futura/vencida na emissão.
- Dados e regras próprios de CDs, FRs, ATA/Contrato e Material Entrada e Saída.

Não ativar emissão, aprovação, envio ou movimentação antes de definir essas regras. Os outros tipos permanecem no estado anterior; esta etapa não representa a conclusão do módulo inteiro.

## Validação

`tests/dlOrderDrafts.test.mjs` cobre identidade da origem, quantidades, total com arredondamento, datas, estrutura de armazenamento e conflito de gravação. Validação em Chromium cobre criação, reabertura após recarregar, edição, exclusão, limites, preservação dos saldos, filtros e larguras de 1540, 980, 390 e 320 px.
