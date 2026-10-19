# Reformulação visual — entrega de 19/10/2026

## Concluído

- Navegação única, sem divisão lateral entre Estoque e Compras, recolhível e utilizável por teclado e em celular.
- Aquisições com Planejamento de DLs e Controle de DLs.
- Pedidos com áreas delimitadas: Estoque (CDs, FRs, DLs) e Compras (ATA/Contrato e Material Entrada e Saída).
- Base visual compacta para visão geral, catálogo, ciclos, aquisições, controle, tarefas e acompanhamento: superfícies claras, azul de destaque, títulos, controles e tabelas consistentes.
- Detalhes de itens do catálogo, origens do Controle e tarefas em painéis laterais.
- Limpeza de filtros em Ciclos e Tarefas; navegação direta ao conteúdo por teclado.
- Conteúdo das seis etapas de Requisição e processo preservado, inclusive dimensões tipográficas, numeração, situações e espaçamento interno.

## Preservação e limites

Serviços, chaves de armazenamento, IDs, cálculos, numeração, anexos, histórico e regras de aprovação não foram modificados nesta reformulação. A apresentação em maiúsculas usa CSS nos campos e listagens abrangidos; não regrava dados antigos. Os diálogos continuam nativos, com foco e Escape.

Tarefas continua sendo demonstração em memória, sem atribuição ou permissão real. Pedidos CDs conserva a fila demonstrativa existente. FRs, DLs, ATA/Contrato e Material Entrada e Saída têm suas áreas delimitadas, mas não ganharam execução, integração ou movimentos reais nesta entrega. Configurações continua indicada como futura. Baixa de saldo, autenticação e numeração anual não integram esta entrega visual.

As pranchas geradas são referências de direção visual. Não representam novas regras de negócio nem compromisso de implementar campos, indicadores ou áreas fictícias.

## Revisão final executada

- 128 testes existentes aprovados; TypeScript e build de produção aprovados.
- Chromium: navegação expandida/recolhida, acesso aos módulos e às cinco áreas de Pedidos, desktop, tablet e celular sem transbordamento global nos cenários verificados.
- Catálogo: painel lateral, cancelamento, salvamento, persistência, abas e Escape.
- Controle: filtros, ordenação e abertura da origem do item; navegação sem regravação dos dados de domínio.
- Tarefas: lista/kanban, filtros, encaminhamento, devolução e conclusão simulados; painel lateral e limpeza de filtros sem reiniciar exemplos.
- DLs: edição e bloqueio de planejamento, resumo da contratação, histórico e cronograma com validação, cálculos e persistência.
- Comparação dos estilos confirma as seis etapas aprovadas preservadas internamente.

Verificações realizadas neste ambiente, com dados fictícios em contextos de navegador isolados. Não representam acesso ou alteração dos dados do navegador do usuário nem validação de integrações corporativas.

## Sincronização

A base visual foi enviada no commit bb4fe5f. O acabamento seguinte está no commit a02438b. Novos envios ao GitHub seguem a solicitação explícita de sincronização do usuário. Os scripts de verificação Chromium desta sessão ficam em /workspace/onboarding-tools; dependem do ambiente local e não fazem parte do pacote do aplicativo.
