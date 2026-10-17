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
- A importação foi revisada: novos e existentes com diferenças são tratados em ações separadas, com revisão explícita para atualizar.
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


## Simplificação: apenas Status
A interface passa a usar somente o Status Ativo/Inativo no interruptor do item e no filtro do catálogo. O controle separado de Visibilidade foi retirado. Mostrar continua sendo o filtro mestre por tipos. O campo legado visible é preservado nos dados existentes por compatibilidade, mas não filtra mais a listagem; portanto, itens anteriormente ocultos podem voltar a aparecer conforme o recorte de tipos e status. Nenhum cadastro ou evento antigo é excluído, nem há conversão automática de itens ocultos em inativos.

## Barra compacta do catálogo
- Mostrar mantém filtro mestre e preferência; o botão usa ícone de filtro e contagem de tipos.
- Tipo, Grupo, Critério e Status ficam na mesma linha em telas amplas; em telas menores, adaptam-se a duas ou uma coluna.
- Visibilidade foi retirada; não há mais campo independente.
- Preparar seleção abre diretamente os três destinos (Ciclo de suprimento, Planejamento DLs, Preparação de pedido direto), substituindo o seletor Adicionar a. Sem itens selecionados, o botão fica desabilitado. A ação continua sendo preparação demonstrativa e não cria vínculos ou reservas reais.
- Ordenar foi movido para a linha de ações ao lado de Preparar seleção, com ícone A–Z, opções Descrição/Código/Grupo e descrição e indicação da opção atual.
- Altura dos controles do catálogo reduzida para 36px, mantendo o tema azul. Menus fecham por Escape ou clique fora; seleção de destino respeita os itens filtrados.


## Importação protegida do MXM
A importação CSV/TXT identifica itens pelo código MXM, preservando zeros à esquerda. XLSX ainda não é suportado. A prévia separa novos, existentes com diferenças e sem alteração. Arquivos com códigos repetidos, registros sem código/descrição, critérios desconhecidos ou colunas ambíguas são bloqueados antes de gravar qualquer item. Campos opcionais ausentes/vazios não apagam os dados atuais; itens ausentes na extração não são removidos ou inativados.

Adicionar somente novos é uma ação independente, com a quantidade explícita no botão de confirmação. Ela não altera existentes. Revisar atualizações exige Editor demonstrativo: nenhum campo vem marcado; o responsável escolhe itens e diferenças de Descrição, Unidade, Tipo, Grupo e Critério. Código, ID, especificação técnica, status e associações não são substituídos. Campos não escolhidos permanecem como estão. Diferenças não aprovadas continuam pendentes, sem aplicação automática.

Para atualizar, primeiro gerar o backup JSON para download e conferir se o navegador salvou o arquivo; em seguida digitar exatamente ATUALIZAR. O backup contém itens, ciclos e histórico anteriores à atualização, com versão de formato e data. Não há restauração automática do JSON nesta entrega. O sistema consegue verificar que gerou o download, mas não confirmar que o usuário conservou o arquivo no computador.

Mudanças registram origem do arquivo e valores anteriores/novos no histórico do item. Falhas ao gravar o histórico desfazem a gravação dos itens antes de concluir; não se anuncia sucesso. Alterações nos dados persistidos por outra aba impedem a importação, solicitando recarga e nova revisão. Leituras antigas de arquivos não substituem uma seleção de arquivo mais recente.

Validação: 15 testes automatizados (`npm test`, Node 24 validado), build e fluxo no Chromium. Cenário 1.600→1.608 preservou os 1.600 existentes e incluiu oito novos; revisão por campo, confirmação exata, backup JSON anterior à edição, proteção de especificações/status/vínculos, cancelamento, duplicados, falha simulada de armazenamento, bloqueio de alteração externa e recarga foram exercitados. Dados usados nos testes são fictícios e isolados do navegador do responsável.

## Compartilhar com requisitante
A opção fica em Preparar seleção e usa somente os itens selecionados ainda presentes no resultado filtrado, na ordem exibida. Abre uma janela de preparação, sem enviar mensagens ou alterar o cadastro.

- Copiar texto: código MXM, descrição, unidade, critério e grupo; se o navegador bloquear a área de transferência, seleciona o texto e orienta a cópia manual.
- Baixar PNG: tabela com tema azul, os mesmos campos, quantidade total, página e data/hora de geração em America/Sao_Paulo. O arquivo não inclui especificações internas, histórico ou vínculos.
- Listas longas são paginadas e baixadas uma página por vez. Descrições longas são quebradas em linhas, com continuação quando necessário, sem truncamento. Não há envio automático ao requisitante.
- Modal funciona no modo Consulta, preserva a seleção ao fechar e não grava eventos de envio, porque apenas preparar/copiar/baixar não comprova que houve envio.

Validação: 19 testes automatizados totais e build; navegador verificou seleção de três itens sem vazamento do quarto, cópia real para clipboard, fallback manual, PNG válido, paginação, Escape, largura móvel e preservação dos dados. O PNG gerado também foi inspecionado visualmente.
