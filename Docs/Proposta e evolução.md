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

## Primeira versão funcional de Ciclos de suprimentos
Tela separada em `src/pages/estoque/CiclosSuprimento.tsx`, com componentes próprios para formulários, seleção de materiais, destino da seleção do cadastro e grupos/modelos. O cadastro aprovado foi mantido, com ligação funcional ao ciclo no menu Preparar seleção.

### Fluxo disponível
- Lista de ciclos abertos/todos/encerrados, busca, criação, edição e abertura. Não há exclusividade entre ciclos: vários podem estar em Planejamento ou Em execução simultaneamente. Ciclos encerrados podem ser reabertos em Editar ciclo.
- Cada ciclo mostra todos os seus materiais, quantidade prevista, grupo de solicitação e base/observação da previsão. Há busca, filtro por grupo e paginação de 50 linhas.
- Inclusão pela tela do ciclo ou Cadastro → Preparar seleção → Ciclo de suprimento → escolher ciclo e grupo. O seletor oferece materiais ativos ainda não presentes no ciclo, com busca e filtros MXM. Campos MXM não são alterados pelas operações do ciclo.
- Uma linha por material em cada ciclo, com um grupo de solicitação por vez, como decisão inicial para impedir contagem duplicada. O mesmo material pode pertencer a outros ciclos independentemente.
- Quantidade em branco = A definir; zero = nenhuma necessidade prevista. Quantidades positivas podem ter decimais. Base da previsão: Estimativa, Consumo anterior, Demanda do setor ou Não informada; observações são próprias da necessidade naquele ciclo.
- Grupo de solicitação é independente do Grupo/Tipo MXM. É possível criar/renomear/excluir grupos, distribuir materiais selecionados em lote e abrir um recorte por grupo. Excluir um grupo mantém os materiais no ciclo, sem grupo.
- Modelos reutilizáveis guardam somente nome e seleção de materiais. Podem ser salvos de um grupo ou de uma seleção; substituição exige confirmação. Aplicá-los em outro ciclo cria sua composição independente, sem copiar quantidades, pedidos ou recebimentos. Materiais já existentes são preservados sem duplicar nem mudar automaticamente seu grupo; itens ausentes/inativos são informados e não adicionados.
- Retirar materiais do ciclo preserva o cadastro MXM e outros ciclos, mediante confirmação. Materiais com referência futura a pedidos não podem ser apagados ou ter sua quantidade sobrescrita sem o fluxo de ajuste correspondente.

### Integração e preservação
Inclusões, retiradas, ajustes de quantidade/grupo/base/observação e mudanças relevantes nos dados do ciclo registram eventos no histórico individual do material. A aba Pedidos e DLs agora consulta os vínculos de ciclos realmente criados, por ID. O cadastro impede exclusão de materiais ainda ligados a ciclos, permitindo mantê-los como inativos. O resumo do Painel utiliza as linhas de planejamento reais em vez das linhas estáticas de demonstração.

Solicitado, em trânsito, recebido e falta solicitar ainda não têm integração de pedidos: aparecem como Não conectado, sem zeros ou cálculos fictícios. Não há emissão de PCD/PDF nem numeração nova de pedidos nesta etapa. A preparação de quantidades totais/parciais para pedidos de CD/FR/DL será a próxima integração.

### Persistência
Metadados mantêm a chave `suprimentos:cycles:v1`. Linhas, grupos por ciclo e modelos usam `suprimentos:cycle-planning:v1` (versão 1). Dados anteriores do cadastro e histórico são preservados. As linhas demonstrativas de `data.ts` não são transformadas em vínculos reais nem movimentos de pedidos.

As gravações de planejamento/ciclos/histórico são feitas em conjunto, com recuperação dos valores anteriores se uma etapa falhar. Alterações de outra aba impedem sobrescrita e solicitam recarga. Dados de planejamento inválidos são preservados e a edição é bloqueada para diagnóstico. O backup JSON da importação inclui também o planejamento e modelos. Tudo continua local ao navegador; não há backend, autenticação real ou restauração automática de backups nesta entrega.

### Validação
32 testes automatizados totais, incluindo 13 de planejamento; build TypeScript/Vite. Testes no Chromium cobriram criação, simultaneidade, grupos, inclusão pelas duas origens, deduplicação, quantidades a definir/zero, modelos e independência entre ciclos, retirada, exclusão de grupo sem perda de materiais, encerramento/reabertura, histórico/vínculos no item, proteção contra exclusão de itens vinculados, recarga e largura móvel. Outro fluxo testou 125 materiais com paginação, seleção segura, mudança de grupo em lote, falha de quota com rollback e alteração em outra aba. Regressões do cadastro: filtro Mostrar, importação protegida e compartilhamento texto/PNG passaram novamente. Dados de teste são fictícios e isolados.

## Correção da importação de unidades
A cópia antiga do importador não reconhecia UNID e usava UN como fallback; isso é uma causa possível para unidades incorretas relatadas pelo responsável, ainda dependendo da conferência da extração usada. A versão atual reconhece Unidade/UNID/UND/UN/UM/Unidade de medida e variações usuais, mantendo o valor informado em maiúsculas. Novos materiais sem unidade ou sem coluna reconhecida bloqueiam o arquivo: não há preenchimento automático como UN. Para existentes, unidade ausente/vazia continua preservando a unidade atual.

A prévia dos novos itens mostra sua unidade. Na revisão dos existentes, Selecionar somente unidades marca apenas diferenças de unidade e desmarca os demais campos, mantendo o download de backup e a confirmação ATUALIZAR. A correção de unidade não converte quantidades planejadas nos ciclos. Cadastro manual e edição também exigem unidade preenchida.

Não foi feita correção automática dos dados no navegador do responsável: é necessário confrontar os códigos com a extração do MXM e aplicar as diferenças aprovadas. Testes cobriram cabeçalhos, bloqueio de novos sem unidade, UN→KG isolado, preservação das personalizações e exibição da unidade atualizada no ciclo sem recalcular quantidade. Total atual: 35 testes automatizados, mais o fluxo de navegador da correção.

## Confirmação para trocar grupos em lote
Aplicar grupo agora abre uma janela com a quantidade de materiais afetados, grupos de origem e destino. As opções são Não, manter grupo (foco inicial) e Sim, alterar grupo. Cancelar ou usar Escape não altera os dados nem o histórico; escolher o grupo atual também não gera alterações. Após confirmar, quantidades são preservadas e o histórico registra origem → destino. Build e teste de navegador dessas condições passaram.

## Tabela de ciclos mais compacta
A coluna e o botão Ajustar foram retirados; o código do material continua abrindo o mesmo formulário Planejar material, sem mudanças nos campos. Larguras foram reduzidas, cabeçalhos/descrições podem quebrar linha e os totais ainda não conectados usam — com legenda e identificação acessível, sem exibir zero. Validado no navegador: dez colunas cabem sem rolagem em 1366px; em telas pequenas a rolagem fica apenas na tabela. Build e teste de abertura pelo código passaram.

## Menu por setores
Navegação extraída para `src/components/AppSidebar.tsx`, na ordem solicitada:
- Administração: Cadastro de itens; Tarefas; Configurações. As duas últimas são entradas futuras, desabilitadas e sinalizadas como Em breve, sem telas fictícias.
- Estoque: Painel; Ciclos de suprimentos; Planejamento e Controle DLs; Pedidos diretos; Acompanhamento de pedidos.
- Compras: Acompanhamento pedidos de ATA / Contratos, com indicação de que a tela ainda será desenvolvida; nenhuma integração de contratos foi criada.

Planejamento e Controle DLs é uma única entrada, com duas abas preservando os conteúdos das áreas anteriores. O encaminhamento do cadastro para Planejamento DLs continua abrindo a aba de planejamento. A localização no topo identifica setor e módulo; a entrada de DLs fica ativa em ambas as abas. Em telas pequenas, o menu tem rolagem própria e mantém os títulos dos setores.

Validação: build e navegação no Chromium, ordem dos setores/itens, entradas futuras bloqueadas, duas abas de DLs, cadastro, ciclos, pedidos, localização e rolagem móvel. Nenhuma chave de dados locais foi alterada nesta reorganização.

## Planejamento de DLs — rascunho, orçamento e requisição
Primeira etapa implementada após a confirmação da nomenclatura DL/PCD/PDL/PFR e da próxima sequência DL-0029. A referência DL-0028 define apenas o ponto inicial; não foram inventados materiais ou processos anteriores.

- Listagem pesquisável e filtro de situação; criação com ID estável, código sequencial e abertura automática em horário brasileiro.
- Materiais associados ao cadastro central, seleção pela tela ou pelo Cadastro → Preparar seleção; inclusão em rascunho existente sem duplicar nem apagar valores.
- Quantidades em milésimos e preços em centavos, arredondamento monetário por linha e orçamento automático; rascunhos incompletos identificados como parciais. Unidades são preservadas; mudanças posteriores no cadastro geram aviso, sem conversão implícita.
- Identificação, justificativa, responsável, requisição MXM, datas e referências oficiais separados do número interno. Conclusão do planejamento exige dados completos e confirmação; reabertura explícita para alterar orçamento.
- Histórico da DL com antes/depois; inclusão, retirada e orçamento também registrados no histórico individual dos itens. Detalhes do item mostram os planejamentos associados, separados de saldos e pedidos reais.
- Salvamento local explícito, aviso de alterações não salvas, validação de revisão, conflito entre abas e gravação transacional com histórico. Exclusão de materiais vinculados bloqueada; backup de importação inclui o planejamento de DLs.

Escopo seguinte: contratação e fornecedores finais, comparação de valores e liberação de saldo após definição das regras oficiais; documentos e conexão de pedidos também pendentes. Nenhum saldo, reserva ou recebimento é gerado pelo orçamento desta etapa. A permissão continua demonstrativa/local.

Validação: 44 testes automatizados passaram e build de produção aprovado. Chromium verificou DL-0029/DL-0030, cancelamento sem consumir número, orçamento de R$975,00, unidade KG, persistência após recarregar, descarte protegido, conclusão/reabertura, exigência de dados MXM, envio pelo cadastro, histórico, proteção contra quota/conflito/corrupção e visualização móvel. Regressões de importação de unidades, confirmação de grupos e tabela compacta de ciclos também passaram.


## Contratação e Controle de DLs — segunda etapa
Regras confirmadas pelo usuário: um único fornecedor por material em cada DL; liberação apenas com pedido de compra MXM emitido e dados finais conferidos. A mesma DL pode conter materiais contratados com fornecedores diferentes; o mesmo material continua podendo participar de outras DLs.

Aba Contratação e fornecedores implementada em tabela compacta, com identificação do fornecedor, pedido/data MXM, quantidades e preços finais, data da contratação, vigência opcional, observações e resultados não contratados com motivo. Orçamento e contratação mantêm valores independentes e comparação absoluta/percentual. Resultados incompletos podem ser salvos sem gerar origens de saldo.

A conclusão exige resultados para todos os itens, pelo menos uma contratação válida, requisição MXM com data, referência oficial da DL e data da contratação. Quantidades finais podem diferir das previstas, com resumo explícito para conferência. A janela de conclusão exige confirmação dos pedidos emitidos e texto CONCLUIR; cancelamento e falha de armazenamento preservam os dados anteriores. Finalização repetida não duplica origens; dados concluídos ficam protegidos contra edição direta/reabertura. Ajustes posteriores requererão fluxo específico auditado.

O Controle consulta o mesmo registro de DL, sem cópia independente. IDs de contratação identificam as origens por DL/material/fornecedor/pedido MXM. Há visão geral, saldos iniciais, pedidos ainda não conectados e histórico. Filtros por situação, fornecedor e categoria; busca por DL/material/pedido; vigência futura, encerrada e aviso de até 30 dias para vencimento. Cadastros anteriores permanecem compatíveis, sem migração destrutiva da chave v1.

Recebimentos e reservas aparecem como Não conectado, não como quantidades operacionais conhecidas. Os saldos exibidos são iniciais da contratação registrada e não incorporam consumos anteriores do ERP. Integração de pedidos PDL, reservas, baixas, documentos e ajustes contratuais permanecem pendentes. Nenhuma movimentação real do ERP foi executada.

Histórico individual dos materiais registra fornecedor, pedido, quantidades/preços anteriores e novos, resultados sem contratação e conferência da conclusão. O vínculo também aparece na aba Pedidos e DLs do item. Backup da importação já inclui a chave de DLs inteira, agora também com resultados e conclusão.

Validação: 61 testes automatizados e build de produção aprovados. Chromium verificou orçamento de R$975,00 versus final de R$924,00, resumo e confirmação, cancelamento sem saldo, gravação transacional com recuperação após falha, origem protegida e persistente, compatibilidade de dados legados, referências no catálogo, filtros, contratos separados do mesmo material, decimal 1,125 KG e rolagem local em tela móvel. Regressões de ciclo completo, tabela compacta e importação de unidades também passaram. O roteiro antigo de ciclos foi atualizado apenas para conferir a apresentação já aprovada de —/aria-label Não conectado.

## Observação/justificativa, entrega e preparação do fluxo MXM
Campos reorganizados conforme o uso no MXM: Justificativa passa a Observação / Justificativa; o espaço de Observações passa a Data de entrega. Sem migração destrutiva: dados legados continuam com seus campos originais e são apresentados juntos. Se o usuário editar o campo unificado, o texto completo é salvo em justification e a mudança dos valores anteriores fica no histórico. A data é opcional no rascunho e exigida no novo fluxo de requisição; registros antigos e contratações concluídas não são alterados automaticamente.

Novas situações: Gerar requisição → Analisar requisição gerada → Em processo. O envio para gerar exige entrega e orçamento completo. Salvar número e data MXM na etapa de geração passa à análise automaticamente. A conferência exige uma ação explícita, com confirmação e registro de data/identificação local. O formulário não apresenta Em processo como simples alternativa para pular a análise. Alterar o número ou a data após a conferência invalida a análise anterior e devolve o registro para nova conferência. A contratação fica bloqueada enquanto o novo fluxo aguarda geração/análise. Estados legados permanecem compatíveis para preservar os registros da etapa anterior.

Resumo reutilizável para a futura tarefa do aprendiz: mesma DL, objeto, observação/justificativa, entrega, responsável, itens centrais por ID/código, descrição, unidade, quantidade e especificação técnica. A tela mostra dados salvos, evitando misturar conteúdo de um rascunho não confirmado com a tarefa futura.

Limite desta etapa: nenhuma tarefa, perfil, posição funcional ou atribuição a pessoa real foi criada. O futuro desenho atribuirá a geração ao aprendiz e retornará a análise ao responsável; o MXM permanece responsável pela execução oficial. A conferência atual é manual, com identificação demonstrativa de sessão.

Validação: 74 testes automatizados e build aprovados. Chromium verificou textos legados, edição com espaços/quebras de linha, entrega obrigatória e persistente, resumo MXM, geração/análise automática, cancelamento/aceite da análise, reanálise após alteração, contratação protegida enquanto pendente, histórico e largura móvel. Os roteiros da contratação/Controle e recuperação após falha também passaram.

## Apresentação de preço e categoria nas DLs
Preço unitário previsto passa a mostrar moeda BRL ao sair do campo e nos campos bloqueados; durante a edição, mantém o valor decimal sem símbolo ou separador de milhar. A formatação é apenas visual: campos vazios continuam vazios, valores inválidos ficam disponíveis para correção e o salvamento continua em centavos. Categoria aparece em maiúsculas na listagem, preservando o texto original armazenado. Build e Chromium aprovados para 50, 0,89, 1.234,56, edição, vazio, entrada inválida, persistência e planejamento concluído.

## Simplificação dos campos da requisição
Retirados da tela Número do processo, Referência oficial da DL e Observações / motivo da situação. O campo Responsável pela tramitação passa a Responsável pela compra. Número/data da requisição e situação permanecem. Valores antigos dos campos retirados são preservados; a referência oficial deixa de ser exigida na conclusão. Para registrar motivos novos, use Observação / Justificativa do planejamento. Os pedidos de compra MXM, fornecedores, quantidades, preços e demais requisitos da contratação permanecem validados. Os 74 testes e o build passaram.


## Vigência por meses e Cronograma da DL
A vigência automática usa Data da contratação / Emissão do pedido como data-base e uma quantidade inteira de meses. Exemplo aprovado: 17/10/2026 + 3 meses = 17/01/2027. A operação usa meses de calendário, ajustando dias inexistentes ao último dia do mês de destino, sem cálculo aproximado por 30 dias ou deslocamento por fuso. Campos calculados não são editados diretamente; datas antigas permanecem manuais até o usuário optar por Calcular por meses e salvar. A data-base e os meses ficam preservados para validar a consistência do vencimento.

Criada a aba Cronograma por DL, com período previsto de abastecimento separado da vigência, autorização prevista/solicitada/recebida, previsão da requisição, prazo do processo (padrão inicial 1 mês), prazo de entrega (padrão 10 dias) e escolha entre corridos/úteis. Não foi assumida a opção de contagem ainda não confirmada pelo usuário. Dias úteis excluem apenas finais de semana; feriados ficam para futura configuração. Dados reais de requisição e contratação vêm dos registros existentes; a previsão informada não é substituída pelas datas reais.

A tabela mostra previsões, realizações e indicadores de prazo. O processo usa a requisição real como início do prazo operacional, e a entrega usa a emissão real do pedido; previsões originais informadas continuam visíveis. Alterações nas previsões e realizações ficam no histórico. A entrega realizada no cronograma é exclusivamente informativa e não movimenta saldos. Após a conclusão da DL, somente o cronograma pode ser atualizado nesse fluxo, sem modificar título, itens, contratação, preços, vigência ou origens. No Controle, o cronograma é somente consulta.

Ajustes recebidos durante o desenvolvimento: retirada de Observações da contratação, código MXM/CNPJ do fornecedor e data do pedido por item. Os valores históricos desses campos permanecem preservados. Novos dados da contratação usam uma única data-base para os pedidos dos itens, com auditoria das mudanças; a identificação separada do fornecedor deixou de ser requisito para concluir. Quantidade final vem preenchida do planejamento e não é editável na tabela. Contratações já salvas com outra quantidade permanecem intactas, e rascunhos com quantidade ausente recebem a planejada ao abrir/salvar.

Planejado para Configurações: Fornecedores, Critérios de solicitação e outros cadastros simples; futuramente o fornecedor será escolhido em pop-up conectado ao cadastro. Não foi criado cadastro paralelo de fornecedores nesta etapa.

Validação: 89 testes automatizados e build aprovados. Chromium verificou vigência automática e fim de mês, opção explícita sobre datas antigas, preservação de textos/identificações/quantidades antigas, quantidade planejada preenchida, pedidos com data-base compartilhada, campos retirados, cronograma por DL, indicadores, atualização pós-conclusão sem mudar contratação/saldos, consulta no Controle, persistência, histórico e largura móvel. As proteções contra quota, conflito entre abas e dados corrompidos também passaram.


### Requisição: envio, análise e correção — 17/10/2026
Salvar rascunho não envia a requisição. Número e data ficam abaixo das informações MXM; Enviar para análise bloqueia os campos. Aprovar segue para Em processo; devolver exige observação e libera correção. Planejamento concluído protege metadados e materiais; reabertura explícita invalida envio e análise anteriores. Histórico integrado usa os mesmos eventos, com atalho visível para Cronograma. Perfis e distribuição de tarefas continuam pendentes.

Contratação: data-base, vigência e vencimento alinhados na mesma linha, explicação abaixo e disposição vertical em telas pequenas. Validados 92 testes, build e fluxos Chromium de envio/correção/aprovação/reabertura, contratação e cronograma; coordenadas e alturas dos três campos conferidas no navegador.


### Seis etapas da requisição à aprovação final — 17/10/2026
Requisição e processo reúne Gerar justificativa (modelo básico sem IA), Gerar requisição, Analisar requisição (Responsável pelo estoque), Registro do pedido anexado, Definição de fornecedores e Aprovação. Preenchimento final saiu de Contratação e fornecedores, agora resumo de consulta. Envio de fornecedores valida os dados e bloqueia edição até devolução com observação; somente a aprovação final libera as origens no Controle. Reabrir planejamento invalida envio da requisição/análise e envio de fornecedores, preservando dados e documento. Registros legados continuam legíveis.

Anexos locais PDF/PNG/JPG até 20 MB, IndexedDB separado do workspace, download e metadados auditados. Falha na gravação da DL limpa o arquivo novo. Documento ausente bloqueia envio/aprovação; o anexo precisa ser registrado novamente. Arquivos não entram no backup JSON ou Git e ainda não são compartilhados entre usuários. Perfis reais e armazenamento central ficam pendentes.

Validados 99 testes, build e Chromium: seis etapas, rascunho/envio/análise, bloqueios, anexo inválido, falha de gravação, documento ausente, download, persistência, devolução/reenvio, resumo sem edição, aprovação única, saldos somente ao concluir, histórico e tela móvel. Regressões de unidades/importação e tabela compacta de ciclos conferidas.


### Múltiplos anexos e fechamento do processo no registro do pedido — 17/10/2026
Botão Anexar arquivos com ícone, seleção de vários documentos e lista com download individual. O botão permanece Registrar pedido, conforme ajuste do usuário. Registrar muda o status para Pedido gerado e identifica na tela/histórico a data do fechamento do processo. A definição de fornecedores e a aprovação final continuam; o fechamento não libera saldo. Acréscimos preservam os arquivos anteriores e a primeira data de fechamento; após envio para aprovação continuam bloqueados até devolução. Compatibilidade com anexo único legado preservada. Recuperação do arquivo local original mantém os IDs.

Validação: 103 testes e build; Chromium cobre vários anexos, acréscimo sem perda, rollback de arquivos, arquivo ausente e recuperação, persistência/download, status Pedido gerado, bloqueios, correção/reenvio e aprovação final sem antecipar saldo.


### Apresentação final e conferência de conclusão da DL — 17/10/2026
Tabela de fornecedores compacta, quantidade/unidade integradas, preços em moeda e totais alinhados. Modal de conclusão com cabeçalho/rodapé fixos e conteúdo rolável, fonte uniforme e descrições que quebram linha. A confirmação normaliza caixa e espaços antes de chamar o serviço estrito; o checkbox e a validação dos dados continuam obrigatórios. Corrigida a seleção do campo monetário ao alternar moeda/edição para evitar concatenar o valor anterior.

Validado no Chromium o percurso completo, incluindo quatro materiais, conferência com cancelar, minúsculas/espaços, requisitos obrigatórios, versões desktop/móvel, conclusão única e Controle com quatro origens e R$ 6.504,00 persistidos. Teste em dados demonstrativos isolados, sem alterar os dados locais do usuário.


### Histórico somente na aba própria — 17/10/2026
Removidas as listas repetidas de histórico do Cronograma e de Requisição e processo. Os registros salvos e sua gravação continuam intactos, disponíveis na aba Histórico. Indicadores de situação e mensagens operacionais das etapas continuam nas respectivas telas.


### Confirmação final sem digitação — 17/10/2026
Retirado o campo de digitação CONCLUIR. A conclusão mantém o checkbox obrigatório e abre um pop-up confirmar/cancelar; cancelar não altera a DL nem cria saldos. Compatibilidade do serviço com chamadas anteriores preservada. Validados 104 testes e build, além do percurso Chromium: histórico somente na aba própria, conferência obrigatória, cancelamento sem alteração, quatro origens liberadas somente ao confirmar e Controle persistido após recarregar.


### Padrão compacto das seis etapas — 17/10/2026
Componente visual compartilhado para títulos numerados, situações com ícones, expansão e corpo de cada etapa. Mantidos os títulos e a ordem existentes, com campos/ações compactos, paleta azul e cinza e descrições diretas. Etapas concluídas recolhidas, etapas em andamento abertas e consulta manual pelo título. Retirados os expansores redundantes internos de justificativa/fornecedores. Recolher preserva estado em edição e anexos selecionados. Nenhuma mudança de regra ou estrutura dos dados. Validados build, testes existentes e Chromium no percurso completo e versões desktop/móvel.


### Cabeçalho compacto de Materiais e orçamento — 17/10/2026
Aplicado o desenho enviado: título/categoria/abertura/entrega/vigência na primeira linha e justificativa/solicitante na segunda. Layout responsivo e controles compactos. Usuário confirmou vigência como período previsto em meses: campo opcional próprio `plannedValidityMonths`, com validação, histórico e bloqueio após fechar planejamento. Previsão não altera a vigência contratual real nem preenche datas ou previsões antigas. Validados 107 testes, build e Chromium com alinhamento das cinco caixas, edição/persistência, congelamento após fechamento e apresentação móvel.


### Histórico compacto, andamento e contratação automática — 17/10/2026

Histórico único com ícones, filtro de atividades e detalhes expansíveis; eventos antigos, inclusive snapshots de processo, são apresentados de forma legível sem regravação. Indicador das seis etapas baseado nas transições efetivas, com devolução e reabertura. Fornecedores conserva apenas preenchimento dos itens; resumo financeiro e contratual permanece na aba de consulta.

Registrar pedido utiliza a data de Brasília e os meses previstos no planejamento para calcular o vencimento por calendário. Valores antigos e primeiro registro são preservados; registros anteriores incompletos podem completar os dados automáticos sem substituir anexos. Cabeçalho mais compacto, sem aviso abaixo da entrega.

Validação: 117 testes, build e Chromium com fluxo completo, filtros sem alteração dos eventos, histórico no Controle, datas em limite de fuso/mês, preservação de dados legados, campos de fornecedores, anexos e aprovação final única.


### Acabamento das etapas e visualização dos anexos — 17/10/2026

Numeradores das etapas concluídas usam o azul do tema. Salvar alterações fica cinza e desabilitado quando não há alterações pendentes, voltando a habilitar ao editar. Cada anexo tem Visualizar ao lado de Baixar: PDF e imagem abrem em diálogo, sem iniciar download; fechar libera a URL temporária.

Validação: build, TypeScript e Chromium com salvar/editar, numeradores concluídos, visualização de PDF e imagem, fechamento/reabertura e download preservado.


### Ajuste dos numeradores e acesso ao cronograma — 17/10/2026

Etapas concluídas têm numeradores com fundo azul do tema e texto branco. Removido o bloco superior Andamento do processo. Cronograma sai da lista de abas e continua acessível pelo botão no topo; a abertura padrão passa a Materiais e orçamento. Funcionalidades e dados do cronograma preservados. Build e navegador conferidos.


### Listagem compacta de processos de aquisição — 18/10/2026

Busca e filtro de situação alinhados, ação Nova DL com ícone, contagem de resultados e limpeza dos filtros. Tabela com colunas dimensionadas, valores monetários alinhados à direita, nomes longos com quebra e situações em marcadores discretos. Textos da listagem, navegação de DLs e janela de criação em maiúsculas na apresentação, preservando os dados antigos. Busca sem resultado mostra orientação; em telas estreitas a rolagem fica dentro da tabela.

Validação: build e Chromium em 1540, 980, 650 e 390 px; filtros combinados, aviso sem resultados, limpeza, foco visível, abrir DL existente, criação/cancelamento e dados salvos intactos.


### Densidade e padrão visual das telas de DL — 18/10/2026

Materiais e orçamento, Contratação e fornecedores, Histórico, Cronograma e Controle receberam espaçamentos menores, controles e tipografia consistentes, tabelas com nomes longos legíveis e valores alinhados. Elementos, áreas, informações e ações foram preservados; estilos isolados não mudam cadastro, ciclos ou a tela aprovada de Requisição e processo. Cabeçalho compacto aplicado somente às demais abas.

Cronograma organiza os mesmos campos em Abastecimento, Prazos e previsões e Acompanhamento, mantendo autorização, avisos, cálculos e vigência. Resumo distingue valores parciais, pendências e meses previstos dos dados contratuais; informações ausentes não aparecem como intervalos repetidos ou totais finais. Controle mantém filtros, abas, origens e indicação das integrações ainda não conectadas.

Validação: 117 testes aprovados, build e Chromium em 1540, 980 e 390 px; edição/salvamento de materiais, fechamento/bloqueio, resumo vazio/final, histórico sem regravação, prazos e validações, cronograma após conclusão sem mudar contratação/origens, filtros e consulta no Controle. Comparação da captura e métricas confirma Requisição e processo idêntica à versão aprovada.


### Controle inicial por material, no formato da planilha — 18/10/2026

A entrada do Controle passa a exibir uma linha por origem contratada, preservando materiais iguais de DLs/fornecedores diferentes. Colunas: Pedido (PDL), Objeto / descrição, QTD, Valor unitário, Pedido MXM, Fornecedor, Saldo e Último pedido. Descrição inclui código, objeto da aquisição e link para os detalhes da DL. Mantidos resumo, filtros e abas internas. Busca e filtro de fornecedor atuam por item, sem retornar outras linhas do mesmo processo.

QTD vem da contratação e Valor é o preço unitário. Saldo continua inicial, sem consumos/reservas fictícios. Como ainda não existem solicitações PDL estruturadas, PDL e Último pedido aparecem como travessão; não são inferidos do código da DL nem da data do pedido MXM. Nenhuma escrita ou migração de dados.

Validação: build e Chromium com oito colunas, somente itens contratados/liberados, origens separadas, quantidades decimais/unidades históricas, preço unitário, filtros combinados por fornecedor/material/MXM/categoria/situação, detalhes e histórico, persistência intacta e rolagem móvel.


### Correção da nomenclatura da planilha — 18/10/2026

Confirmado pelo usuário: os antigos PDLs da planilha representam as aquisições hoje chamadas DLs. A primeira coluna do Controle é DL e exibe o código existente da aquisição, clicável para os detalhes. Retirada a repetição do código da DL na descrição. Último pedido continua reservado à solicitação vinculada, sem inferir datas da contratação. Nenhuma renumeração ou migração de registros. PDL permanece o termo do futuro pedido ao fornecedor ligado ao ciclo e ao saldo.
