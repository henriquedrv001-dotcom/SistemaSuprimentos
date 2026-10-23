# Modelos de interface

Catálogo persistente para reutilizar elementos quando solicitado pelo usuário. É parte do repositório e deve ser consultado em futuras alterações visuais; não depende da memória de uma conversa. Registrar um modelo não autoriza alterar as outras funções automaticamente.

## Regra permanente: temas claro e noturno

Por orientação do usuário, toda alteração de interface a partir desta etapa deve funcionar nos dois temas. Reutilizar cores semânticas, preservar contraste de textos, estados ativos, campos, tabelas, menus e diálogos, e conferir as duas apresentações antes de concluir. Evitar introduzir superfícies brancas ou cores de texto fixas que prejudiquem o modo noturno. A alternância e a preferência de tema devem permanecer disponíveis, sem alterar dados de negócio.

## Catálogo

| ID | Modelo | Implementação | Situação e uso |
| --- | --- | --- | --- |
| UI-FLT-01 | Caixa de seleção de filtro | `src/components/ui/FilterSelect.tsx` | Implementado nos filtros de Planejamento, Controle e Histórico de Processos de Compra; aguardando avaliação visual desta rodada. |
| UI-FLT-02 | Busca com ícone e rótulo | `src/components/ui/FilterSearch.tsx` | Aplicado às buscas de Planejamento e Controle. |
| UI-BAR-01 | Grade de filtros alinhados | `.ui-filterbar` em `InterfaceModels.css` | Rótulos acima, caixas na mesma linha e quebra responsiva pela largura disponível. |
| UI-NAV-01 | Seletor segmentado | `src/components/ui/SegmentedControl.tsx` | Planejamento/Controle no cabeçalho, ao lado de Nova DL. Referência: imagem 5 do usuário. |
| UI-NAV-02 | Seletor de tipo de pedido | `NewOrderDialog` em `OrdersWorkspace.tsx` com `FilterSelect` | Dentro de Novo pedido: janela compacta com grupos Estoque e Compras, nomes resumidos e ação Continuar; compatível com os dois temas. |
| UI-PICK-02 | Seleção de múltiplas DLs | `DLMovementPlanPicker.tsx` | Janela central, busca e checkboxes, fornecedor comum, confirmação ao aplicar; campo principal de altura fixa. |
| UI-SUM-02 | Pendências durante a distribuição | `.movement-live-balances` em `DLMovementWorkspace.css` | Resumo fixo na seção de materiais, atualizado em tempo real e com destaque da área em edição; dois temas. |
| UI-FLOW-01 | Distribuição de DL por área | `DLMovementWorkspace.tsx` | Área principal ampla, solicitação com múltiplas DLs e fornecedor único, resumo financeiro, grade de áreas, tabela cruzada de quantidades, etapas NF/solicitações e impressão por área; temas claro/noturno. |
| UI-BTN-01 | Ação principal azul | `.primary-button` existente | Base atual, reutilizada em Nova DL; nenhum novo comportamento ou redesenho de todos os botões nesta rodada. |
| UI-TBL-01 | Tabela compacta de processos | `src/components/dl/Acquisitions.css` | Base atual com cabeçalhos alinhados e rolagem local; colunas dependem da função. |
| UI-CHK-01 | Checkbox quadrado | `.ui-checkbox` em `InterfaceModels.css` | 18 × 18 px, azul ao marcar, foco visível e estado parcial; aplicado ao seletor de materiais da DL. |
| UI-PICK-01 | Seletor amplo de materiais | `CycleItemPicker.tsx` no contexto `dl` e `DLMaterialPicker.css` | Janela central ampla, filtros em linha, lista com rolagem própria, ações no topo e paginação no rodapé. Ciclos conserva sua apresentação anterior. |
| UI-SUM-01 | Resumo financeiro inferior | `.dl-budget-summary` em `Acquisitions.css` e `DLPlanningEditor.tsx` | Valor em destaque à direita e explicação de pendências separada; abaixo da tabela, acessível sem rolagem horizontal no celular. |
| UI-DLG-01 | Área ampla para dados e conferência | `.ui-data-dialog` em `InterfaceModels.css` | Aplicado à conclusão da DL e às listas dos indicadores do Controle. Ocupa o viewport com margens pequenas, corpo rolável e cabeçalho/ações fixos. |
| UI-DLG-02 | Lateral para consulta ou alteração pontual | Apresentação existente em `modern.css` e `.dl-control-item-dialog` | Mantida para dados de um item e edição pontual de cadastro; não usar para listagens extensas ou conferência de várias linhas. |

A área Pedidos reutiliza UI-FLT-01/02, UI-BAR-01, UI-NAV-01, UI-CHK-01 e o resumo inferior. Preparação e consulta de vários materiais ocupam a área principal; recebimento usa UI-DLG-01 com conferência por item. Ações curtas e Nova DL usam janelas compactas centrais, com altura ajustada ao conteúdo. A consulta de um item continua lateral. A baixa manual abre uma janela compacta de quantidade, responsável e justificativa.

Os modelos de filtros e navegação desta rodada ainda precisam do aceite visual do usuário. Exemplo de solicitação futura: “Aplicar UI-FLT-01 e UI-BAR-01 no Catálogo”. Não copiar lógica de saldo ou fluxo ao reutilizar apresentação.

## UI-FLT-01 — seleção

Nas listagens de Processos de Compra, título principal, subtítulo da seção, filtros e tabela compartilham a mesma margem esquerda, sem o recuo automático de `panel`. Planejamento e Controle usam subtítulos de 14 px, peso 700, linha 1,4, caixa normal; cabeçalhos de tabela têm 11 px, peso 600 e preenchimento 12 × 10 px. A linha do subtítulo tem altura mínima de 24 px e 14 px até os filtros. Em desktop, reservar a área da barra de rolagem evita deslocamento horizontal entre telas curtas e longas. No celular, o título e as ações permanecem alinhados à esquerda. Indicadores e campos específicos de cada função são preservados.

- Campo de 38 px, raio de 7 px, fundo branco, borda suave e seta à direita.
- Rótulo de 11 px acima do campo. Opções de 12 px, caixa alta apenas visual: valores e textos originais não são regravados.
- Lista própria branca, cantos arredondados, destaque azul claro e check na opção selecionada. Abertura para cima quando faltar espaço, limite de altura e rolagem interna.
- Texto completo nas opções; campo fechado pode resumir com reticências e título nativo. Largura limitada ao viewport.
- Contrato controlado: `value`, `options: { value, label, disabled? }[]`, `onChange(value)`, `label?`, `aria-label?`, `disabled?`. Preservar as mesmas opções, identificadores e callbacks do filtro original.
- Acessibilidade: combobox/listbox, estado expandido, seleção anunciada e opção ativa; setas, Home/End, Enter/Espaço, Escape, Tab e busca por digitação com acentos. Escape fecha a lista sem fechar um diálogo externo.
- Lista usa a camada de popover do navegador, com portal no diálogo mais próximo quando houver. Requer navegador moderno com suporte a Popover API, como o Edge/Chrome atual do usuário. Não alterar o menu nativo do sistema operacional globalmente.
- Não grava no armazenamento, não altera dados de domínio e não introduz dependências externas.

```tsx
<FilterSelect
  label="Situação"
  value={status}
  onChange={setStatus}
  options={[{ value: "", label: "Todas" }, { value: "Ativa", label: "Ativa" }]}
/>
```

## UI-BAR-01 — composição

Usar `.ui-filterbar` com filhos `.ui-filter-field`. As colunas usam `minmax(0, …)`; nunca atribuir largura fixa aos campos. Busca, seleções e sentido da ordenação devem compartilhar altura e alinhamento de base. Ações de limpar não mudam a largura das colunas. A opção de zerados permanece disponível no Controle.

O painel hospedeiro deve usar `container-type: inline-size`: até 850 px de conteúdo, a busca ocupa a linha completa e os filtros ficam em duas colunas; até 400 px, uma coluna. Isso considera a largura da barra lateral, não apenas a janela. Colunas específicas podem ser definidas pela variável `--ui-filter-columns`.

## UI-NAV-01 — modos

Grupo com botões Planejamento/Controle, estado ativo azul e estado inativo neutro. Preservar callbacks de navegação e proteções contra perda de alterações. Não transformar mudança visual em salvamento, criação de registros ou redefinição dos filtros. Título das duas vistas: **PROCESSOS DE COMPRA**. A mudança do título não renomeia DLs, chaves de dados ou tipos de pedidos.

## Manutenção

Estilos compartilhados ficam em `src/components/ui/InterfaceModels.css`, limitados às classes `ui-*`; layout específico continua em `Acquisitions.css`. Ao aprovar ou revisar um padrão, atualizar seu estado e descrição aqui. Ao replicá-lo em outra função por solicitação, conferir opções completas, textos longos, teclado, seleção atual, estado vazio, filtros combinados e responsividade. Filtros não devem mudar os seletores que editam dados de formulários (por exemplo, resultado da contratação ou contagem de dias).

## UI-PICK-01 e UI-CHK-01 — seleção de materiais

O seletor de DL ocupa até 1480 px de largura e 920 px de altura, respeitando margens do viewport. No celular, ocupa a tela. Busca/Tipo MXM/Grupo MXM compartilham a linha em telas amplas; em telas estreitas, reorganizam-se com os modelos UI-FLT-01/02. Os popovers permanecem dentro do diálogo nativo, sem perder a interação modal.

Fechar e Adicionar selecionados ficam no cabeçalho; não duplicar Cancelar no rodapé. Anterior, Página N de M e Próxima ficam no canto inferior. Cabeçalho, filtros e paginação permanecem disponíveis enquanto a lista rola. A seleção inicial é vazia; Adicionar só habilita com itens selecionados. Checkboxes nativos têm dimensões quadradas fixas, e a seleção parcial dos resultados usa `indeterminate`.

Preservar a regra de exclusão de materiais já incluídos/inativos, 50 itens por página, seleção entre páginas, filtro de Grupo subordinado ao Tipo e destino do grupo de solicitação quando aplicável. Selecionar resultados abrange todos os resultados filtrados, incluindo outras páginas. Fechar/Escape não inclui os materiais nem salva o planejamento. Seleção, fechamento de popover e confirmação de inclusão são ações diferentes.

## UI-SUM-01 — total previsto

Manter o resumo no rodapé da área de materiais, fora da rolagem horizontal da tabela. Valor de 26 px, azul e alinhado à direita. À esquerda, título e identificação Parcial quando houver dados faltantes. Explicar a base do parcial: soma dos materiais com quantidade e preço informados. Quantidade de materiais pendentes fica abaixo do valor, com singular/plural correto. Quando houver um valor inválido, mostrar revisão necessária, sem substituí-lo por zero. Usar o cálculo de domínio existente, sem arredondamentos paralelos ou mistura com valor contratado.

## Sugestão editável de solicitante

`src/config/uiDefaults.ts` registra o nome padrão solicitado pelo usuário. Novas DLs recebem essa sugestão; rascunhos sem solicitante a recebem ao abrir, apenas no estado de edição até salvar. Nomes já existentes e planos bloqueados/concluídos são preservados. O campo continua editável e pode ser limpo; o salvamento respeita o que foi digitado. É preenchimento sugerido, não autenticação nem lista de colaboradores. Não aplicar automaticamente esse nome a outras funções.

## Escolha de área — diretriz do usuário

Telas com muitos dados, tabelas de vários materiais, seletores e conferências devem usar uma área ampla. A lateral funciona para edição de cadastro ou consulta pontual de um item, com pouca informação. A quantidade de dados e o trabalho a executar definem o modelo; não converter automaticamente todo diálogo em lateral.

UI-DLG-01: `dialog.item-edit-dialog.ui-data-dialog`, com filhos `.ui-data-dialog-heading`, `.ui-data-dialog-body` e `.ui-data-dialog-footer`. Em desktop, ocupa o viewport menos 32 px; em celular, ocupa toda a área disponível. Apenas o corpo rola verticalmente; as ações permanecem acessíveis. Tabelas devem aproveitar a largura e quebrar descrições extensas, deixando rolagem horizontal local apenas quando a tela não comportar as colunas. Preservar Escape, foco e todas as confirmações de negócio. Aplicado nesta rodada aos diálogos de Aquisições; demais funções seguem suas respectivas rodadas.

## Acesso ao registro sem repetir documentos

Na consulta de Contratação, apresentar apenas **Consultar documentos do pedido** quando houver documentos. O atalho deve navegar para Processo, expandir Registro do pedido e posicionar/focar seu cabeçalho. A visualização e o download ficam no registro original. Planos antigos sem documentos recebem uma indicação textual, sem atalho sem destino. Navegar/consultar não pode regravar o plano, mudar etapa, conceder permissões nem duplicar ou excluir arquivos. `DLWorkflowStep.revealKey` permite a abertura pontual da etapa sem impedir seu recolhimento manual.

## UI-NAV-02 — tipo de pedido

A listagem Pedidos reúne todos os tipos. Novo pedido abre uma janela compacta central com rótulo “Selecione o tipo de pedido” e escolha inicial vazia. Estoque contém Transferência, Fundo rotativo e DL ESTOCÁVEL; Compras contém DL PARA ENTRADA E SAÍDA. ATA/Contrato fica temporariamente oculto na criação, preservando registros existentes. Continuar só habilita após escolher um tipo e abre o formulário correspondente na área principal. Cancelar ou Escape não cria registro nem reserva saldo. A troca de tipo não aparece no cabeçalho da página; a listagem conserva o filtro Tipo. Preservar códigos internos, registros existentes e confirmação ao sair de uma edição não salva. Validar nos temas claro e noturno.

Nos formulários de pedidos, não apresentar Observações; manter motivos obrigatórios de devolução e cancelamento. DL PARA ENTRADA E SAÍDA não usa seletor de ciclo. Somente Transferência apresenta Requisição MXM, após o salvamento dos itens. Essas condições também valem para consultas e confirmações de etapa, sem apagar os valores históricos.

## UI-FLOW-01 — distribuição, NF e solicitações

Usar a área principal para o fluxo de entrada e saída. Mostrar etapas sem permitir saltar validações. Valores previstos, distribuídos e diferenças são distintos; só confirmar quando o valor total e todas as áreas conferirem. Manter origens e preços da DL protegidos. Quantidades por área têm rótulos acessíveis, sem repetir textos extensos em cada célula. Tabelas podem rolar horizontalmente dentro de seu próprio contêiner quando houver muitas áreas; a página não deve rolar lateralmente no celular. Ações de conferência de NF, solicitação e atendimento abrem na própria página, com foco na conferência. Impressão por área é separada da NF. Consultar `DL entrada e saida.md` antes de alterar as regras financeiras ou de saldo.

DL para entrada e saída: seleção em janela com lista de checkboxes e busca, fornecedor único em comum e preenchimento automático quando houver apenas uma opção. O campo principal mantém altura fixa e mostra quantidade de DLs selecionadas. Só Aplicar seleção confirma a edição; Fechar/Escape descarta a escolha provisória. Incompatibilidade deve explicar por que não há fornecedor em comum. Materiais identificados pela DL e origem; busca vazia ou sem resultados deve explicar o estado. Campos monetários reutilizam `DLMoneyInput`; não misturar máscara de moeda com entradas de quantidade.

## UI-SUM-02 — valores junto às quantidades

Ao distribuir materiais, manter previsto, distribuído e falta/excesso por área na própria seção de materiais. O resumo fica fixo ao rolar essa seção, sem depender dos cartões de configuração acima. Mostrar também valor total e diferença global. Destacar a área do campo em edição; em telas estreitas, manter a área focada visível no resumo horizontal e ajustar ao redimensionamento. Não alterar cálculos de domínio nem arredondamentos para construir a apresentação. Conferir se o resumo não cobre o campo em edição.


## UI-EXP-01 — Cadastro e Validades

Cadastro reutiliza FilterSearch e FilterSelect, mantendo filtros dependentes, seleção e operações existentes. As unidades têm apresentação curta e uniforme; Conferir unidades é uma consulta e não corrige dados automaticamente.

Validades usa a área principal para painel, filtros e lista de lotes; registro, baixa e histórico usam janela compacta central com corpo rolável e ações acessíveis. Registrar vários lotes mantém material e responsável após salvar. Alterações não salvas exigem confirmação ao sair; erros preservam os campos preenchidos. A página e os diálogos devem funcionar nos temas claro e noturno e em telas estreitas, com rolagem horizontal restrita à tabela. As regras de dados estão em Validades.md.
