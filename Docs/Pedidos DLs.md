# Pedidos — execução local

## Áreas e comportamento

A listagem reúne todos os tipos. Novo pedido abre uma janela compacta para escolher o tipo; Continuar abre o formulário específico na área principal. As opções de Estoque são Transferência (PCD), Fundo rotativo (PFR) e DL ESTOCÁVEL (PDL); Compras oferece DL PARA ENTRADA E SAÍDA (MOV). ATA/Contrato fica temporariamente fora de Novo pedido, com seus registros e fluxo existentes preservados. Cancelar a escolha não grava registros. Códigos, numeração e dados salvos permanecem os mesmos. Acompanhamento conserva sua função de consulta.

Pedidos mantém a divisão Estoque (CDs, FRs e DLs) e Compras (ATA/Contrato e Material Entrada e Saída). Cada tipo tem listagem, busca por referências e materiais, filtros por situação/fornecedor/ciclo, ordenação, indicadores e edição na área principal. Acompanhamento usa os mesmos registros, com visões Todos, Em aberto, Parciais, Atrasados e Concluídos. Não são inseridos pedidos de demonstração.

- CD: seleciona materiais presentes no planejamento do ciclo escolhido. O planejamento é uma estimativa e não representa estoque físico.
- FR: seleciona materiais ativos do catálogo; exige justificativa ao encaminhar. O ciclo é opcional.
- DL: seleciona origens liberadas e vigentes. A identidade é o par ID da DL + ID da contratação, com unidade, fornecedor, preço e MXM protegidos. Rascunhos podem reunir fornecedores; para encaminhar, precisam conter um único fornecedor. Não há separação automática.
- ATA/Contrato: informa referência da ata/contrato e fornecedor; materiais vêm do catálogo. Ainda não há um cadastro mestre de atas nem leitura de seu saldo oficial.
- DL PARA ENTRADA E SAÍDA (MOV): identifica Entrada ou Saída; a saída usa a ação Registrar atendimento. Não altera o estoque físico ou contábil do MXM.

Solicitante recebe sugestão editável do nome padrão. DL PARA ENTRADA E SAÍDA não apresenta vínculo de ciclo. Nenhum formulário de pedido apresenta Observações, inclusive nas confirmações de etapa; motivos obrigatórios de devolução e cancelamento são mantidos. Requisição MXM pertence apenas à Transferência e só pode ser incluída depois de salvar seus itens, ao editar o rascunho ou registrar o envio. Campos históricos retirados da interface permanecem nos dados existentes. Preços não informados deixam o valor explicitamente parcial; não são apresentados como orçamento completo. Quantidades têm até três casas decimais, preços até duas; totais arredondam centavos por linha.

## Etapas

Rascunho → Em análise → Aprovado → Enviado → Recebimento parcial → Concluído. Devolução da análise ou aprovação retorna para rascunho, com motivo obrigatório e preservação de número/histórico. Envio e recebimento são registros manuais: o aplicativo não envia mensagens ao fornecedor nem integra com MXM. Aprovação registra o nome informado, sem autenticação nem autorização por perfil.

Recebimento informa apenas o adicional daquela entrega, limitado ao pendente de cada linha. Receber tudo conclui o pedido. Cancelamento exige motivo, preserva recebimentos anteriores e encerra apenas o restante; pedidos concluídos não podem ser cancelados. Atraso é calculado a partir da entrega prevista e nunca cancela nem libera reserva automaticamente.

A numeração interna por tipo (PCD-0001, PFR-0001, PDL-0001, ATA-0001 e MOV-0001) é atribuída somente ao encaminhar; não renumera DLs nem substitui referência MXM. Rascunhos nunca encaminhados podem ser excluídos. Após encaminhar, usar cancelamento para preservar o histórico.

## Saldo da DL — regra confirmada pelo usuário

Ao salvar os materiais em um PDL, suas quantidades já ficam reservadas, inclusive enquanto o pedido está em rascunho. Não esperar aprovação nem envio. Editar um rascunho reconcilia a própria reserva: diminuir quantidade, retirar material ou excluir o rascunho libera a diferença; aumentar exige saldo livre. Devolver para correção mantém a reserva até uma alteração explícita. Rascunhos antigos, criados quando não existia reserva, recebem indicação para editar e salvar (ou encaminhar) antes de ativá-la; abrir a versão nova não cria reservas retroativas.

Recebimentos são informados por item. A conferência identifica Integral, Parcial ou Não veio conforme as quantidades daquela entrega. Só o que foi recebido gera baixa; o que falta permanece reservado enquanto o pedido estiver aberto. Receber todo o pendente conclui o pedido. Para concluir com faltas, marcar **Encerrar entrega: o que não veio não será mais entregue**: o restante de cada item é registrado como não entregue e liberado da reserva, sem baixa. Campos vazios nesse encerramento contam como zero recebido, com explicação na tela. Cancelamento também libera o pendente e preserva as baixas anteriores. Um pedido concluído com faltas distingue Recebido, Pendente (zero) e Não entregue.

Na consulta de item no Controle de DLs, **Baixa manual** permite registrar consumo fora do PDL, com quantidade, responsável e justificativa. Não pode usar quantidade reservada. Para uma entrega vinculada a pedido, usar o recebimento no PDL para evitar duplicidade. Baixas manuais têm histórico próprio e não alteram o documento original da DL.

Disponível = contratado − recebimentos locais − reservas abertas − baixas manuais. Cada cálculo usa a origem exata (DL + contratação), sem juntar contratos ou unidades de um mesmo material. Controle de DLs, indicadores, ordenação, últimos pedidos, consulta de origem e aba Pedidos vinculados usam os registros locais. O valor financeiro contratado inicial continua original. Não há atualização de estoque físico do MXM nem sincronização externa.

## Persistência e compatibilidade

Chave nova: `suprimentos:orders:v1`, incluindo tipos, contadores, reservas, recebimentos, faltas e histórico de baixas manuais. A chave anterior `suprimentos:dl-order-drafts:v1` não é removida. Quando a chave nova não existe, seus rascunhos são importados em memória com os mesmos IDs, origens, quantidades, datas e observações; só a primeira alteração explícita grava a chave nova. Abrir telas não grava pedidos.

Falha de leitura bloqueia escrita e preserva os dados originais. Escritas comparam as chaves nova e antiga com as lidas pela aba; conflito mantém a edição aberta. O contexto de catálogo, ciclos e DLs é relido antes de validar a alteração. A gravação dos pedidos é uma única substituição de chave; não modifica o documento original da DL. O catálogo protege itens vinculados a pedidos contra exclusão. O backup de catálogo inclui o workspace de pedidos. Trocar de tela ou recarregar com alterações não salvas pede confirmação.

É um fluxo local por navegador, sem compartilhamento entre usuários, backend transacional, envio externo ou integração de estoque físico. Essas integrações e autorização por perfil continuam fora desta entrega.

## Validação

`tests/orders.test.mjs` cobre os cinco fluxos, reserva ao salvar, recebimento parcial/encerramento com faltas/cancelamento e baixa manual, conflito por origem, limites, dados específicos, vigência, numeração, imutabilidade e migração de rascunhos. Os testes antigos de rascunhos são mantidos para o formato legado. Validação Chromium cobre os cinco tipos, campos específicos, filtros, persistência ao recarregar, saldos no Controle, migração sem regravar a DL, documentos e responsividade.
