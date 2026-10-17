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

Concluir somente o planejamento não constitui saldo contratado. A contratação e o Controle foram acrescentados na segunda etapa descrita abaixo; documentos e integração de pedidos permanecem pendentes. Nomenclatura confirmada: DL = aquisição; PCD = pedido ao CD ligado ao ciclo; PDL = pedido ao fornecedor ligado ao ciclo e saldo de DL; PFR = pedido emergencial, com ou sem ciclo. Registros demonstrativos antigos de pedidos não foram renomeados automaticamente.


## Contratação e Controle de DLs — segunda etapa
Na aba **Contratação e fornecedores**, registre um fornecedor por material, pedido de compra MXM e preço final. A quantidade vem preenchida do planejamento e a data do pedido usa a data da contratação/emissão. Os campos ficam em tabela, com edição direta e comparação entre orçamento previsto e contratação. Materiais sem contratação precisam de resultado e motivo; não geram saldo.

É possível salvar resultados incompletos e retomá-los. Após concluir o planejamento, preencha os dados oficiais da DL/requisição e a data da contratação. Informe a vigência quando aplicável. A ação **Concluir DL e disponibilizar no Controle** exige salvar antes, revisar o resumo, confirmar que os pedidos de compra MXM foram emitidos e os dados finais conferidos, e digitar **CONCLUIR**. A conclusão é única: protege os dados finais e mantém os IDs da DL e das origens, sem criar outra cópia do processo.

O Controle oferece pesquisa por DL, material, fornecedor ou pedido MXM, filtros de situação/fornecedor/categoria, totais iniciais e detalhes com visão geral, materiais/saldos e histórico. Contratações do mesmo material em DLs diferentes permanecem separadas. Os detalhes individuais dos itens também mostram essas origens e o histórico da contratação.

**Os saldos desta etapa são iniciais.** Reservas, recebimentos e consumos anteriores do MXM não estão conectados; a tela os identifica como Não conectado. Nenhum pedido é criado automaticamente. Documentos, movimentações e ajustes posteriores de contratos concluídos serão tratados nas próximas etapas, com histórico próprio. Permanecem o armazenamento local e a identificação demonstrativa de usuário da versão atual.

Validação: `npm test` executa 89 testes; `npm run build` gera a versão de produção. Fluxos também conferidos no Chromium, incluindo compatibilidade dos planejamentos anteriores, conclusão/cancelamento, falha no salvamento, filtros, unidades decimais, tela móvel e preservação do cadastro/ciclos.

## Informações e fluxo da requisição MXM
Em Materiais e orçamento, **Observação / Justificativa** reúne os textos usados no MXM. Observações antigas continuam preservadas; ao editar o campo unificado, o texto completo passa a ser salvo nele, com histórico. **Data de entrega** ocupa o antigo campo de observações e é exigida para iniciar o novo fluxo de requisição, sem bloquear a leitura de planejamentos antigos.

Após concluir o planejamento, seus dados e materiais ficam bloqueados até **Reabrir planejamento**. Em Requisição e processo, **Gerar requisição** apresenta o resumo expansível e, abaixo, número e data MXM. **Salvar rascunho** mantém essa etapa; **Enviar para análise** exige os dois dados e bloqueia sua edição. A análise permite aprovar para **Em processo** ou devolver para correção com observação obrigatória. Reabrir o planejamento invalida o envio e a análise anteriores, exigindo nova conferência.

O histórico dentro da requisição e a aba Histórico consultam os mesmos eventos da DL. O cabeçalho também oferece um atalho **Cronograma**. Na contratação, data-base, meses e vencimento ficam alinhados na mesma linha em telas maiores e empilhados em telas pequenas.
O resumo **Informações para gerar a requisição no MXM** mostra os dados salvos: objeto, observação/justificativa, entrega, responsável, códigos, materiais, unidades, quantidades e especificações. Os dados são referenciados pelo mesmo item e DL, sem uma segunda base independente.

**Tarefas e perfis funcionais ainda não foram implementados.** Nesta versão o fluxo é manual/local; nenhuma tarefa é enviada ao aprendiz. A futura distribuição de Gerar requisição ao aprendiz e da análise ao responsável usará estas informações. As situações antigas continuam legíveis, sem inventar responsáveis ou confirmações retroativas.

Validação atual: 92 testes automatizados, build e fluxos no Chromium, incluindo envio explícito, devolução, aprovação, bloqueios, reabertura, falha de armazenamento, contratação, cronograma e apresentação móvel. Os bloqueios seguem o estado do processo; autorização por perfil depende da futura autenticação.


## Vigência automática e Cronograma
Em Contratação e fornecedores, informe **Data da contratação / Emissão do pedido** e **Vigência (meses)**. O vencimento é calculado por meses de calendário: 17/10/2026 + 3 = 17/01/2027. Para dias inexistentes no mês de destino, usa o último dia daquele mês (31/01 + 1 mês = 28/02, ou 29/02 em ano bissexto). Datas manuais antigas são preservadas; o botão Calcular por meses permite trocar o método explicitamente antes de salvar.

A aba **Cronograma** separa período de abastecimento, autorização da gerência, requisição, processo, entrega e vigência. Padrões iniciais editáveis: processo de 1 mês e entrega em 10 dias. Escolha a contagem da entrega: corridos ou úteis. Dias úteis consideram segunda a sexta, sem feriados. As datas reais de requisição/contratação são lidas dos dados salvos nas outras abas. Os indicadores comparam prazos, sinalizam proximidade/atraso e mantêm as mudanças de previsão no histórico.

A entrega realizada nesta aba é apenas acompanhamento: **não confirma recebimento, não reserva e não baixa saldo**. Mesmo após concluir a DL, o cronograma pode ser atualizado pelo Planejamento; contratação, valores, vigência e origens de saldo continuam protegidos. O Controle permite consultar o cronograma, sem editar seus campos.

Observações da contratação, identificação do fornecedor por código/CNPJ e data individual do pedido saíram do formulário. Dados antigos permanecem armazenados. Novos salvamentos de contratação usam a data-base única nos itens; alterações são auditadas. Quantidades finais são preenchidas com a quantidade planejada e não precisam ser digitadas; valores já registrados em contratações são preservados.

Próxima organização em **Configurações**: Fornecedores, Critérios de solicitação e outros cadastros simples. O campo Fornecedor futuramente abrirá um seletor de fornecedores cadastrados; nesta versão continua preenchido por texto. Essa tela de configurações e o seletor ainda não foram implementados.

O editor abre em **Cronograma**, primeira aba. Os campos principais usam três colunas em telas maiores; início do planejamento vem da abertura da DL. Datas reais de autorização ficam em seção expansível. Ao final, o histórico resumido mostra aprovações, envios, devoluções e fechamento/reabertura de etapas, a partir do histórico existente. Nas abas de etapas, relógio cinza indica pendência e check azul indica conclusão registrada; Cronograma e Histórico são consultas, sem conclusão artificial.
