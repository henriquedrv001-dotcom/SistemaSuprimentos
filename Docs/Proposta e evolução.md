# Base aprovada e evolução

## Objetivo confirmado
Central de informações da filial para planejar, controlar e acompanhar os processos do setor Estoque, com inclusão futura de Compras. O MXM continua sendo o ERP oficial de execução. O código do item deve ser exatamente o do ERP e será a referência de relacionamento. Integração automática com o ERP ainda não foi estabelecida.

## Base aprovada pelo responsável
A versão azul recuperada pelo responsável no Codespace é o padrão a preservar. Fonte: arquivo src.zip enviado nesta conversa. O conteúdo foi incorporado na branch codex/base-azul-recuperada. A versão verde inicial e sua extração de telas não são a base para novas implementações.

O ZIP contém App.tsx, data.ts, main.tsx, styles.css, supabase.ts, types.ts e um arquivo vazio screens/CadastroItens.tsx. A tela de cadastro efetiva está no App.tsx; o arquivo vazio não é importado. Nenhuma separação de telas foi aplicada nesta recuperação. Os arquivos TSX/CSS enviados foram preservados; em types.ts foi acrescentada somente a interface ItemHistoryEntry, já usada no App.tsx e ausente no arquivo recebido. O arquivo vite-env.d.ts é mantido para os tipos Vite. O package.json do Codespace ainda não foi recebido; a cópia disponível neste ambiente permitiu instalar e compilar a base recuperada.

## Recursos presentes na cópia recebida
- Sete módulos: Painel, Cadastro de itens, Ciclos de suprimentos, Pedidos diretos, Planejamento DLs, Controle DLs, Acompanhamento de pedidos. Vários módulos de pedidos/saldos ainda são demonstrações ou placeholders.
- Tema azul #004C99, marca textual e CSS enviados pelo responsável.
- Cadastro: criação, importação CSV/TXT com prévia, modelo CSV, busca, filtros, ordenação, seleção múltipla, ocultação, edição ilustrativa e histórico local.
- Dados de itens, ciclos e histórico gravados em localStorage; perfis Consulta/Editor apenas ilustrativos, sem autenticação real.
- Nenhuma migração de banco foi executada. O botão de preparação em lote não constitui automaticamente pedidos, ciclos ou saldos.

## Limitações verificadas na auditoria
- Os 1.646 itens vistos no Codespace não fazem parte do ZIP: podem estar no armazenamento do navegador daquela prévia. Não limpar os dados desse navegador; exportar os dados em etapa própria antes de mudar o endereço de acesso.
- Na base recuperada, Mostrar escolhia visíveis/ocultos/todos. A evolução local agora implementa Mostrar por tipos como filtro mestre, ao lado da busca; o controle antigo foi renomeado para Visibilidade.
- A prévia de importação usa o texto 'Serão atualizados', mas a confirmação preserva códigos existentes sem sobrescrever. Corrigir a comunicação em entrega separada.
- Ainda não há segurança de servidor ou verificação de vínculos para exclusões locais.

## Forma de trabalhar
Usar o código aprovado como fonte primária. Fazer uma mudança pequena por vez, comparar diferenças, executar validação e colher retorno. Separar telas gradualmente somente depois de estabelecer a base, preservando visual e comportamento.

O painel Mostrar por tipos foi implementado na evolução local descrita abaixo; ainda aguarda sincronização com o Codespace.

No futuro, o acompanhamento de pedidos terá lista e Kanban usando os mesmos registros e filtros, agrupados por status. Campos e transições serão validados antes de implementar. Reservas, recebimentos e saldos reais exigem persistência segura e regras específicas; o ERP segue oficial.

## Evolução local do cadastro (aguardando sincronização)
Por preferência do responsável, acumular as próximas melhorias neste ambiente e sincronizar com o Codespace ao final.

- Tabela: Selecionar, Código, Descrição, Unidade, Critério e Grupo.
- O código abre a janela somente em Editor demonstrativo; Consulta bloqueia a abertura. Isso não é autenticação real.
- Janela extraída para `src/components/ItemDetailsDialog.tsx`, com abas Edição, Pedidos e DLs e Histórico.
- Edição mantém Tipo e Grupo, adiciona `technicalSpecification` opcional e usa interruptor de status no topo. Status e demais mudanças só se aplicam ao salvar; cancelar descarta o rascunho.
- Pedidos e DLs lê vínculos estruturados opcionais em `Item.associations`, preservando a origem e mostrando pedido MXM, fornecedor, saldo e unidade. Saldo zero é exibido. Nenhum vínculo ou saldo foi inventado nem cadastrado. Módulos que produzirão esses vínculos ainda precisam ser implementados. Ciclos são encontrados por itemId nas linhas de demonstração existentes, sem inferir ligações pela descrição.
- Histórico filtra por itemId, apresenta todos os eventos locais existentes do item, ordenados do mais recente para o mais antigo, e registra valores anteriores e novos dos campos editados. Não há eventos retroativos fabricados para vínculos. Inclusão/remoção real em ciclos, pedidos e DLs deverá registrar eventos quando essas operações forem implementadas.
- As chaves locais de itens, ciclos e histórico foram mantidas. Itens antigos sem os campos opcionais continuam funcionando.

Validação: build TypeScript/Vite; navegador com seis colunas, bloqueio em Consulta, abas por teclado, especificação opcional/persistência, interruptor/cancelamento, histórico isolado por item, associações separadas incluindo saldo zero, ciclo por ID, estados vazios e janela móvel. Exemplos de associações foram injetados somente no navegador isolado de teste, sem alterar os dados do projeto.


## Filtro mestre Mostrar e busca uniforme (aguardando sincronização)
- Busca e Mostrar lado a lado, com altura, borda e foco compatíveis com os demais campos.
- Componente separado `CatalogTypeFilter.tsx`: tipos com pesquisa, checkboxes e contagens, Selecionar todos, Desmarcar todos e Concluir.
- Hierarquia: Mostrar restringe a base visível; Tipo só oferece tipos permitidos; Grupo só oferece grupos dos tipos permitidos e do Tipo escolhido; Critério acompanha esse recorte e o grupo.
- Alterar Mostrar limpa subfiltros e seleção em lote. Mudanças nos demais filtros retiram da seleção os itens fora do resultado. Nenhum item é excluído da base por esse filtro.
- Salvar como padrão, Restaurar padrão e Remover padrão usam a chave `suprimentos:cadastro:mostrar-tipos:v1`. Sem padrão: todos os tipos; seleção vazia: nenhum item. As mudanças só persistem quando o usuário salva o padrão. Remover padrão retorna a todos.
- O padrão é uma visualização única por navegador/endereço, não compartilhada entre usuários ou ambientes. Não há telas de múltiplas visualizações nomeadas nesta entrega.
- Visibilidade (visíveis/ocultos/todos) continua sendo um filtro independente, diferente do filtro mestre de tipos.

Validação do filtro: hierarquia e opções subordinadas, seleção segura, busca, salvar/restaurar/remover padrão e recarga incluindo seleção vazia, fechamento por Escape, alturas iguais, largura móvel e preservação dos itens na base. Build passou.
