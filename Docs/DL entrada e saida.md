# DL para entrada e saída — distribuição por área

Fluxo local de solicitação e fornecedor único, distribuição financeira e quantitativa, entrada de NF e solicitações das áreas. O usuário informa os itens e quantidades; o sistema calcula as diferenças. Não sugerir uma composição de itens para fechar o valor total automaticamente.

## Etapas e regras confirmadas

1. **Distribuição:** selecionar uma ou mais DLs concluídas e vigentes com saldo, mantendo um único fornecedor em comum. Informar justificativa, data da solicitação e valor total. A inclusão de outra DL preserva os itens das anteriores; retirar uma DL remove somente suas origens da edição, com confirmação quando houver quantidades. Selecionar áreas e seus valores previstos. Assistência Social, Educação, Esportes e Nutrição são sugestões editáveis pela seleção; outras áreas podem ser incluídas com nome próprio.
2. Adicionar somente origens contratadas das DLs selecionadas e do fornecedor único. Código, descrição, unidade, preço unitário, pedido MXM e origem são copiados da contratação e conferidos contra os dados atuais ao salvar. Distribuir manualmente as quantidades de cada item entre as áreas.
3. **Salvar distribuição** reserva imediatamente a soma das quantidades de cada origem, compartilhando o saldo com DL estocável e baixas manuais. Um rascunho pode ter diferenças financeiras para continuar depois. Edição reconcilia apenas a própria reserva quando salva; alterações descartadas não afetam saldos.
4. **Confirmar distribuição** exige justificativa/data da solicitação e igualdade entre valor total da solicitação, soma dos valores previstos das áreas, soma dos itens distribuídos e valor de cada área. Revalida saldo e vigência. Atribui o código MOV e bloqueia alterações da composição, seguindo para **Entrada da NF**.
5. **Entrada da NF:** registrar número, emissão, data de entrada, valor e quantidades efetivamente entradas. Entrada parcial baixa só as quantidades registradas e mantém o restante reservado. Valor da NF deve coincidir com a quantidade e preço da origem. Não permitir número repetido dentro da mesma solicitação, quantidades acima do pendente ou datas inválidas/futuras. Uma NF registrada não pode ser apagada por cancelamento comum.
6. Somente após entrada integral, liberar **Solicitações das áreas**. Registrar área, referência da solicitação, data e quantidades. Solicitações e atendimentos podem ser parciais, respeitando o limite distribuído para cada área. A solicitação não pode anteceder a conclusão da entrada da NF. Registrar a quantidade atendida em cada entrega.
7. **Finalizar fluxo** exige entrada completa e atendimento de todas as quantidades distribuídas para todas as áreas. A distribuição é encerrada. Solicitações e atendimentos não geram uma segunda baixa no saldo da DL.

Não usar Ciclo, escolha avulsa Entrada/Saída, Observações nem Requisição MXM neste formulário. Justificativa da distribuição, número da NF e referência da solicitação são identificações próprias de suas respectivas etapas.

## Conferência e impressão

Resumo apresenta valor total da solicitação, total previsto pelas áreas, total efetivamente distribuído e diferenças. Cada área mostra seu previsto, distribuído e diferença. Tabela cruza materiais e quantidades por área, preservando preço e unidade da origem. Valores são calculados em centavos e quantidades em milésimos; cada origem é arredondada uma vez e os centavos residuais são repartidos por maior resto, em ordem estável das áreas. A soma por área corresponde exatamente ao total dos itens. Entradas parciais usam a diferença entre o valor acumulado antes e depois da entrada, evitando cobrar um centavo duas vezes.

Imprimir por área abre documento próprio com fornecedor, justificativa, DL/pedido MXM, material, unidade, preço, quantidade e valores. Rascunho é identificado como prévia. O documento permite imprimir ou salvar PDF pelo navegador; não é NF nem comprovação de entrada no ERP.

Os campos monetários usam o formato brasileiro, por exemplo R$ 1.200,00, ao sair do campo. A edição reutiliza o componente monetário existente e conserva centavos inteiros nos dados. O fornecedor é preenchido automaticamente quando existe uma única opção em comum entre as DLs. A lista mostra DL e fornecedor de cada origem; se não houver fornecedor selecionado, os materiais permanecem visíveis, mas a inclusão fica bloqueada. Busca sem resultados mostra mensagem e ação Limpar busca.

## Persistência e rastreabilidade

Extensão opcional `movementFlow`, versão 1, de `Order` na chave existente `suprimentos:orders:v1`. A seleção múltipla usa `planIds`, com `planId` conservando a primeira DL por compatibilidade. Registros antigos que só têm `planId` continuam legíveis sem regravação ao abrir. Guarda áreas, metas, distribuição, NFs, solicitações e atendimentos acumulados, com eventos do responsável e quantidades de cada operação. Quantidades de `Order.lines` agregam as áreas por origem; `receivedMilli` é somente o que entrou por NF. Etapas são exibidas pelo nome específico, mantendo a compatibilidade com a listagem e Acompanhamento.

A leitura valida áreas, DLs e origens duplicadas, relações, somas, recebimentos, valores, quantidades, etapas e atendimentos. Gravações usam a proteção existente contra alterações em outra aba e falha de armazenamento. A contratação original da DL não é regravada. Controle de DL inclui reservas/entradas desses pedidos e os atalhos para seus registros.

Pedidos MOV anteriores, sem `movementFlow`, continuam legíveis com seus dados originais; não são convertidos automaticamente nem recebem baixa retroativa na DL. Rascunhos anteriores são apresentados para consulta e não são encaminhados pelo fluxo novo; criar uma nova distribuição para usar o controle por áreas. Os demais tipos de pedido mantêm suas regras.

Cancelar antes de registrar NF preserva histórico e libera a reserva. Depois de uma entrada de NF, o cancelamento simples é bloqueado; estorno contábil não foi implementado nesta etapa.

Este fluxo registra as conferências informadas no navegador. Não consulta a entrada real da NF, não transmite solicitações, não efetua pagamentos nem movimenta estoque no MXM. Uma integração transacional e autenticação/permissões dependem de implementação futura.

## Implementação e validação

`DLMovementWorkspace.tsx` ocupa a área principal nos dois temas. Serviços de domínio em `dlMovement.ts`; cálculos e validação de leitura em `dlMovementMath.ts`; impressão em `dlMovementPrint.ts`. Os testes de pedidos cobrem conciliação por área, reserva compartilhada, recebimento parcial, cancelamento, duplicidade/limites da NF, solicitações e atendimentos parciais, encerramento, dados adulterados, vigência e impressão. Chromium valida o exemplo R$ 800 / R$ 200 / R$ 300 / R$ 140 / R$ 160, impressão por área, duas entradas de NF, quatro solicitações/atendimentos, recarregamento, temas e telas estreitas, além de conflito entre abas e falha de armazenamento.
