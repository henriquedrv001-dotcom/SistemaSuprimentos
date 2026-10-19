# Modelos de interface

Catálogo persistente para reutilizar elementos quando solicitado pelo usuário. É parte do repositório e deve ser consultado em futuras alterações visuais; não depende da memória de uma conversa. Registrar um modelo não autoriza alterar as outras funções automaticamente.

## Catálogo

| ID | Modelo | Implementação | Situação e uso |
| --- | --- | --- | --- |
| UI-FLT-01 | Caixa de seleção de filtro | `src/components/ui/FilterSelect.tsx` | Implementado nos filtros de Planejamento, Controle e Histórico de Processos de Compra; aguardando avaliação visual desta rodada. |
| UI-FLT-02 | Busca com ícone e rótulo | `src/components/ui/FilterSearch.tsx` | Aplicado às buscas de Planejamento e Controle. |
| UI-BAR-01 | Grade de filtros alinhados | `.ui-filterbar` em `InterfaceModels.css` | Rótulos acima, caixas na mesma linha e quebra responsiva pela largura disponível. |
| UI-NAV-01 | Seletor segmentado | `src/components/ui/SegmentedControl.tsx` | Planejamento/Controle no cabeçalho, ao lado de Nova DL. Referência: imagem 5 do usuário. |
| UI-BTN-01 | Ação principal azul | `.primary-button` existente | Base atual, reutilizada em Nova DL; nenhum novo comportamento ou redesenho de todos os botões nesta rodada. |
| UI-TBL-01 | Tabela compacta de processos | `src/components/dl/Acquisitions.css` | Base atual com cabeçalhos alinhados e rolagem local; colunas dependem da função. |
| UI-CHK-01 | Checkbox quadrado | `.ui-checkbox` em `InterfaceModels.css` | 18 × 18 px, azul ao marcar, foco visível e estado parcial; aplicado ao seletor de materiais da DL. |
| UI-PICK-01 | Seletor amplo de materiais | `CycleItemPicker.tsx` no contexto `dl` e `DLMaterialPicker.css` | Janela central ampla, filtros em linha, lista com rolagem própria, ações no topo e paginação no rodapé. Ciclos conserva sua apresentação anterior. |
| UI-SUM-01 | Resumo financeiro inferior | `.dl-budget-summary` em `Acquisitions.css` e `DLPlanningEditor.tsx` | Valor em destaque à direita e explicação de pendências separada; abaixo da tabela, acessível sem rolagem horizontal no celular. |

Os modelos de filtros e navegação desta rodada ainda precisam do aceite visual do usuário. Exemplo de solicitação futura: “Aplicar UI-FLT-01 e UI-BAR-01 no Catálogo”. Não copiar lógica de saldo ou fluxo ao reutilizar apresentação.

## UI-FLT-01 — seleção

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
