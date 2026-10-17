# Aplicativo de Suprimentos — protótipo inicial

Este repositório contém a primeira estrutura de código baseada no documento de requisitos.

## Tecnologias
- React + TypeScript + Vite
- PostgreSQL / Supabase (esquema inicial incluído)
- Lucide React para ícones

## Rodar localmente
1. Instale Node.js LTS.
2. Extraia o ZIP e abra esta pasta no Visual Studio Code.
3. Abra o terminal nesta pasta e execute:

```bash
npm install
npm run dev
```

4. Abra o endereço mostrado no terminal. Normalmente: `http://127.0.0.1:5173`.

## Estado atual
A interface é um protótipo com dados demonstrativos. Itens, ciclos e histórico são salvos no armazenamento local do navegador, sem banco conectado. Os exemplos de PDL/pedido ERP são ilustrativos.

O banco ainda não está conectado. O esquema SQL é um ponto de partida que precisa de revisão e complementação antes de ser aplicado ou usado em operações reais.

## Arquivos importantes
- `src/App.tsx`: telas iniciais e navegação.
- `src/data.ts`: dados fictícios.
- `src/types.ts`: tipos de dados.
- `supabase/migrations/`: esquema inicial e regras de integridade.
- `docs/REGRAS_TECNICAS.md`: limitações e próximos passos técnicos.
- Documento de requisitos: arquivo DOCX entregue separadamente.

## Segurança e produção
Não use dados reais do Sesc nesta versão. Antes de produção, implementar autenticação, autorização/RLS, transações para controlar saldos e compromissos, testes, backups e revisão pela TI.


## Importação de materiais MXM
Importe CSV/TXT pelo Cadastro de itens. A prévia mostra novos, diferenças e itens sem alteração. **Adicionar somente novos** preserva os já cadastrados. Para atualizar existentes, ative o Editor demonstrativo, escolha os campos na revisão, baixe o backup JSON e digite **ATUALIZAR**. Especificações técnicas, status e vínculos ficam protegidos. Revise o arquivo baixado antes de continuar. Os dados permanecem locais ao navegador; o perfil Editor não substitui autenticação real.

Para validar a importação (Node.js 24 foi usado na validação):

```bash
npm test
npm run build
```

## Ciclos de suprimentos
Abra um ciclo para gerenciar suas necessidades. Adicione materiais pela própria tela ou pelo Cadastro → Preparar seleção → Ciclo de suprimento. Organize grupos de solicitação independentes dos grupos MXM, ajuste quantidades e salve seleções como modelos reutilizáveis. O mesmo material pode aparecer em ciclos simultâneos, sem duplicar dentro de um mesmo ciclo.

O planejamento é salvo localmente em `suprimentos:cycle-planning:v1`; mantenha o mesmo endereço/navegador para conservar os dados. Pedidos e seus totais ainda não estão conectados. O código da tela está em `src/pages/estoque/CiclosSuprimento.tsx`, e as regras em `src/services/cyclePlanning.ts`.

Novos materiais importados precisam ter a unidade preenchida (colunas como Unidade, UNID ou Unidade de medida). O sistema não assume UN quando falta esse dado. Para corrigir unidades em registros existentes, use Revisar atualizações → Selecionar somente unidades, confira as diferenças e confirme com backup e ATUALIZAR. Isso não converte automaticamente quantidades já planejadas nos ciclos.

## Planejamento de DLs — primeira etapa
Em Estoque → Planejamento e Controle DLs, crie uma DL, inclua materiais e preencha quantidades e preços previstos diretamente na tabela. Também é possível enviar materiais pelo Cadastro → Preparar seleção → Planejamento DLs, escolhendo um rascunho existente ou uma nova DL. Materiais repetidos mantêm o planejamento anterior.

A sequência começa em **DL-0029**, conforme referência informada pelo usuário; nenhum registro fictício DL-0028 é criado. Cancelar o formulário não consome número. O código interno e os identificadores oficiais do MXM permanecem separados.

Use **Salvar alterações** para guardar o rascunho e **Concluir planejamento** para validar e bloquear o orçamento. A reabertura é explícita. A aba Requisição e processo registra a referência MXM e a tramitação; o Histórico registra alterações e valores anteriores. Quantidades aceitam até três casas decimais; preços, duas, sem separadores de milhar. Campos em branco permanecem a definir, sem virar zero.

Os dados são locais, na chave `suprimentos:dl-planning:v1`, incluída no backup JSON da importação. Há proteção contra sobrescrita entre abas, recuperação de gravações incompletas e bloqueio de dados salvos inválidos. Isso não substitui banco compartilhado nem autenticação. Planejamentos também aparecem nos detalhes individuais dos itens e impedem sua exclusão do catálogo.

Concluir somente o planejamento não constitui saldo contratado. A contratação e o Controle foram acrescentados na segunda etapa descrita abaixo; documentos compartilhados e integração de pedidos permanecem pendentes. Nomenclatura confirmada: DL = aquisição; PCD = pedido ao CD ligado ao ciclo; PDL = pedido ao fornecedor ligado ao ciclo e saldo de DL; PFR = pedido emergencial, com ou sem ciclo. Registros demonstrativos antigos de pedidos não foram renomeados automaticamente.


## Contratação e Controle de DLs — segunda etapa
Em **Requisição e processo → 5. Definição de fornecedores**, registre um fornecedor por material, pedido de compra MXM e preço final. A aba **Contratação e fornecedores** é somente consulta dos dados salvos. A quantidade vem preenchida do planejamento e a data do pedido usa a data da contratação/emissão. Os campos ficam em tabela, com edição direta e comparação entre orçamento previsto e contratação. Materiais sem contratação precisam de resultado e motivo; não geram saldo.

É possível salvar resultados incompletos e retomá-los. Após concluir o planejamento, preencha os dados oficiais da DL/requisição e a data da contratação. Informe a vigência quando aplicável. A ação **6. Aprovação → Aprovar e concluir DL** exige registrar o pedido anexado, salvar e enviar os fornecedores para aprovação, revisar o resumo, confirmar que os pedidos de compra MXM foram emitidos e os dados finais conferidos, e digitar **CONCLUIR**. A conclusão é única: protege os dados finais e mantém os IDs da DL e das origens, sem criar outra cópia do processo.

O Controle oferece pesquisa por DL, material, fornecedor ou pedido MXM, filtros de situação/fornecedor/categoria, totais iniciais e detalhes com visão geral, materiais/saldos e histórico. Contratações do mesmo material em DLs diferentes permanecem separadas. Os detalhes individuais dos itens também mostram essas origens e o histórico da contratação.

**Os saldos desta etapa são iniciais.** Reservas, recebimentos e consumos anteriores do MXM não estão conectados; a tela os identifica como Não conectado. Nenhum pedido é criado automaticamente. Documentos compartilhados, movimentações e ajustes posteriores de contratos concluídos serão tratados nas próximas etapas, com histórico próprio. Permanecem o armazenamento local e a identificação demonstrativa de usuário da versão atual.

Validação: `npm test` executa 103 testes; `npm run build` gera a versão de produção. Fluxos também conferidos no Chromium, incluindo compatibilidade dos planejamentos anteriores, conclusão/cancelamento, falha no salvamento, filtros, unidades decimais, tela móvel e preservação do cadastro/ciclos.

## Informações e fluxo da requisição MXM
Em Materiais e orçamento, **Observação / Justificativa** reúne os textos usados no MXM. Observações antigas continuam preservadas; ao editar o campo unificado, o texto completo passa a ser salvo nele, com histórico. **Data de entrega** ocupa o antigo campo de observações e é exigida para iniciar o novo fluxo de requisição, sem bloquear a leitura de planejamentos antigos.

Após concluir o planejamento, seus dados e materiais ficam bloqueados até **Reabrir planejamento**. Em Requisição e processo, **Gerar requisição** apresenta o resumo expansível e, abaixo, número e data MXM. **Salvar rascunho** mantém essa etapa; **Enviar para análise** exige os dois dados e bloqueia sua edição. A análise permite aprovar para **Em processo** ou devolver para correção com observação obrigatória. Reabrir o planejamento invalida o envio e a análise anteriores, exigindo nova conferência.

O histórico dentro da requisição e a aba Histórico consultam os mesmos eventos da DL. O cabeçalho também oferece um atalho **Cronograma**. Na contratação, data-base, meses e vencimento ficam alinhados na mesma linha em telas maiores e empilhados em telas pequenas.
O resumo **Informações para gerar a requisição no MXM** mostra os dados salvos: objeto, observação/justificativa, entrega, responsável, códigos, materiais, unidades, quantidades e especificações. Os dados são referenciados pelo mesmo item e DL, sem uma segunda base independente.

**Tarefas e perfis funcionais ainda não foram implementados.** Nesta versão o fluxo é manual/local; nenhuma tarefa é enviada ao aprendiz. A futura distribuição de Gerar requisição ao aprendiz e da análise ao responsável usará estas informações. As situações antigas continuam legíveis, sem inventar responsáveis ou confirmações retroativas.

Validação atual: 103 testes automatizados, build e fluxos no Chromium, incluindo envio explícito, devolução, aprovação, bloqueios, reabertura, falha de armazenamento, contratação, cronograma e apresentação móvel. Os bloqueios seguem o estado do processo; autorização por perfil depende da futura autenticação.


## Vigência automática e Cronograma
Em Contratação e fornecedores, informe **Data da contratação / Emissão do pedido** e **Vigência (meses)**. O vencimento é calculado por meses de calendário: 17/10/2026 + 3 = 17/01/2027. Para dias inexistentes no mês de destino, usa o último dia daquele mês (31/01 + 1 mês = 28/02, ou 29/02 em ano bissexto). Datas manuais antigas são preservadas; o botão Calcular por meses permite trocar o método explicitamente antes de salvar.

A aba **Cronograma** separa período de abastecimento, autorização da gerência, requisição, processo, entrega e vigência. Padrões iniciais editáveis: processo de 1 mês e entrega em 10 dias. Escolha a contagem da entrega: corridos ou úteis. Dias úteis consideram segunda a sexta, sem feriados. As datas reais de requisição/contratação são lidas dos dados salvos nas outras abas. Os indicadores comparam prazos, sinalizam proximidade/atraso e mantêm as mudanças de previsão no histórico.

A entrega realizada nesta aba é apenas acompanhamento: **não confirma recebimento, não reserva e não baixa saldo**. Mesmo após concluir a DL, o cronograma pode ser atualizado pelo Planejamento; contratação, valores, vigência e origens de saldo continuam protegidos. O Controle permite consultar o cronograma, sem editar seus campos.

Observações da contratação, identificação do fornecedor por código/CNPJ e data individual do pedido saíram do formulário. Dados antigos permanecem armazenados. Novos salvamentos de contratação usam a data-base única nos itens; alterações são auditadas. Quantidades finais são preenchidas com a quantidade planejada e não precisam ser digitadas; valores já registrados em contratações são preservados.

Próxima organização em **Configurações**: Fornecedores, Critérios de solicitação e outros cadastros simples. O campo Fornecedor futuramente abrirá um seletor de fornecedores cadastrados; nesta versão continua preenchido por texto. Essa tela de configurações e o seletor ainda não foram implementados.

O editor abre em **Cronograma**, primeira aba. Os campos principais usam três colunas em telas maiores; início do planejamento vem da abertura da DL. Datas reais de autorização ficam em seção expansível. Ao final, o histórico resumido mostra aprovações, envios, devoluções e fechamento/reabertura de etapas, a partir do histórico existente. Nas abas de etapas, relógio cinza indica pendência e check azul indica conclusão registrada; Cronograma e Histórico são consultas, sem conclusão artificial.


## Processo da DL em seis etapas
Em **Requisição e processo**, o fluxo é: **1. Gerar justificativa → 2. Gerar requisição → 3. Analisar requisição → 4. Registro do pedido → 5. Definição de fornecedores → 6. Aprovação**.

A justificativa tem modelo básico revisável, texto salvo e cópia para documentação. É independente da Observação / Justificativa do MXM e não exige IA. O envio e a devolução da requisição mantêm as regras anteriores; a análise informa **Responsável pelo estoque**, distinto do Solicitante da DL.

Após a análise, a compradora registra o pedido anexado. O aprendiz informa fornecedores, pedidos MXM, preços e vigência na etapa 5; quantidades planejadas continuam preenchidas e fixas. Salvar dados não libera saldo. **Enviar para aprovação** valida todos os resultados e bloqueia edição e substituição do anexo. A devolução exige observação e permite correção/reenvio. A aprovação final mantém a confirmação de pedido emitido e o texto CONCLUIR, criando uma única origem por item contratado. A aba Contratação e fornecedores apresenta somente resumo, orçamento versus valor final, vigência e tabela dos dados salvos. Registros antigos e contratações já concluídas continuam legíveis sem exigir anexos retroativos.

Anexos PDF/PNG/JPG até 20 MB ficam no IndexedDB `suprimentos:documents:v1`, separados do workspace local. Os metadados ficam na DL e no histórico. Se a gravação da DL falhar, o arquivo recém-inserido é removido; nenhum saldo é criado. O arquivo persiste ao recarregar e pode ser baixado. Arquivos ausentes neste navegador bloqueiam o envio dos fornecedores e a abertura da aprovação até registrar novamente o pedido. **Os arquivos não acompanham o backup JSON nem a sincronização Git; baixe-os separadamente.** Compartilhamento entre compradora/aprendiz/gestor e restrições por perfil ainda dependem de backend, autenticação e armazenamento central.

Validação: 103 testes automatizados e build; fluxo completo no Chromium com seis etapas, modelo da justificativa, número/data bloqueados, anexo inválido, falha de gravação com limpeza do arquivo, arquivo ausente, download/persistência, correção/reenvio, aprovação única e saldo somente ao concluir. Cadastro/unidades e apresentação compacta dos ciclos também conferidos.


O registro do pedido aceita **múltiplos anexos** PDF/PNG/JPG, até 20 MB por arquivo. O botão Anexar arquivos mostra uma seleção revisável, com remoção dos arquivos ainda não registrados, e a lista salva oferece download individual. **Registrar pedido** muda a situação para **Pedido gerado**, registra o fechamento do processo de compra e mostra quando isso aconteceu. Esse fechamento não conclui a DL nem cria saldos: fornecedores e aprovação final continuam nas etapas 5 e 6. Novos anexos podem ser acrescentados antes do envio para aprovação, sem substituir os anteriores nem mudar a data do primeiro fechamento. Anexos antigos de arquivo único continuam disponíveis.

A gravação de vários arquivos limpa todos os arquivos recém-inseridos se algum arquivo ou a gravação do workspace falhar. Um arquivo local ausente pode ser recuperado selecionando novamente o original com mesmo nome, formato e tamanho e registrando o pedido; seu identificador e metadados são preservados. Reabrir planejamento mantém os documentos, mas exige novo registro do fechamento após a nova análise antes de enviar os fornecedores. Validação: 103 testes, build e Chromium com anexos múltiplos, acréscimo posterior, recuperação de arquivo, persistência, rollback, Pedido gerado, etapas seguintes e saldo apenas na aprovação final.


Na conferência final, a tabela de fornecedores usa quantidade/unidade juntas, preço em reais e colunas compactas que cabem em 1366px; telas menores mantêm rolagem local. A janela de conclusão tem tipografia uniforme, descrições quebradas por linha e botões visíveis fora da área rolável. A confirmação aceita CONCLUIR em maiúsculas/minúsculas e espaços nas pontas; checkbox, dados oficiais e aprovação continuam obrigatórios. O serviço de conclusão mantém sua confirmação estrita, recebendo o texto normalizado pela interface. Campos monetários selecionam o valor numérico ao receber foco, sem concatenar o valor formatado com o novo texto digitado.

Teste final no Chromium com quatro materiais: edição e persistência de preços, cancelamento sem criar saldos, confirmação minúscula/espaços, palavra errada e checkbox bloqueando conclusão, botões visíveis em desktop/móvel, conclusão única e quatro origens totalizando R$ 6.504,00 no Controle após recarregar. Valores deste teste são demonstrativos; não modificam o armazenamento do navegador do usuário.
