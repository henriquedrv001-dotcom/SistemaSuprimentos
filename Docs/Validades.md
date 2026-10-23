# Validades — operação e decisões

Validades usa os materiais do Cadastro central, pelo mesmo `item.id`. O módulo controla lotes e movimentos locais; não duplica produtos nem altera saldos de DLs, pedidos ou MXM.

## Cadastro e novas chegadas

- **Registrar validade** abre uma janela compacta. O foco começa no título; os resultados do material só abrem ao clicar no campo, digitar ou usar as setas. Busca e seleção usam um único campo.
- Quantidade, lote e validade ficam na mesma linha em desktop. **Adicionar lote** permite registrar vários lotes do material; **Salvar** valida e grava o conjunto de uma vez.
- Uma nova chegada com **mesmo material, lote e validade** soma ao lote existente, com aviso no formulário e nova entrada no histórico. A quantidade inicial e os movimentos anteriores permanecem preservados.
- Também é possível expandir o material e usar **Ações → Nova entrada** no lote. Basta informar a quantidade recebida. Um lote zerado pode voltar a ter saldo.
- Outro lote permanece separado. Um número de lote já existente com outra validade exige conferência dos dados, evitando criar outra data por engano. Linhas repetidas no mesmo formulário são bloqueadas.
- A mesma operação não pode ser reaplicada com o mesmo identificador. Falha em uma das linhas não grava nenhuma delas.

## Lista agrupada

A capa de cada material mostra código/descrição, saldo total e quantidade da validade mais próxima. Expandir mostra todos os lotes desse material, incluindo os zerados, com suas ações. Se vários lotes vencerem na mesma data mais próxima, a quantidade da capa soma esses lotes. Lotes sem saldo não definem a próxima validade.

Agrupamento utiliza a identidade do Cadastro e a unidade registrada. Descrições iguais de códigos distintos não são fundidas, nem unidades diferentes somadas. Totais usam inteiros de precisão arbitrária para não acumular erro decimal.

Busca e situação localizam materiais que contenham pelo menos um lote correspondente. A capa continua mostrando o total real do material, e a expansão mostra todos os seus lotes. O painel mantém contagem de **lotes**, claramente identificada, com as faixas vencido, até 7 dias, de 8 a 30 dias e acima de 30 dias.

## Baixas e prioridade

**Ações → Dar baixa** solicita quantidade e tipo: Consumo ou Descarte. Consumo registra o motivo automaticamente. Descarte usa Vencimento, Avaria ou Outro; somente Outro pede texto adicional. Não permite saldo negativo.

Quando houver outro lote válido do mesmo material vencendo antes, a janela indica qual usar primeiro, seguindo a prioridade de vencimento (FEFO). A operação continua vinculada ao lote escolhido pelo operador. Um lote vencido não pode ser baixado como consumo; pode ser descartado ou conferido. A validade de hoje ainda está no prazo, considerando a data de São Paulo.

## Conferência física / auditoria

- **Conferir estoque**, no cabeçalho, abre os lotes dos materiais localizados na listagem. **Ações → Conferir estoque** abre somente aquele lote.
- Informe a quantidade realmente encontrada, inclusive **zero**. **Confere** preenche a quantidade atual para registrar a confirmação explícita do operador.
- Campo em branco significa **não contado** e não altera esse lote.
- O sistema mostra a diferença antes de salvar. Se houver divergência, exige um motivo para a conferência. A confirmação registra saldo anterior, quantidade encontrada, diferença e data/hora.
- Conferência sem diferença também entra no histórico. A contagem pode corrigir para mais ou para menos sem inventar uma entrada ou consumo.
- Todos os lotes preenchidos são validados antes da gravação. Mudança do saldo durante a contagem impede a aplicação sobre uma base antiga.

Conferir não apaga nem reescreve entradas e baixas. Não há exclusão de movimentos pela interface. A conferência é operacional; aprovação por outro usuário e identidade autenticada dependem da infraestrutura futura.

## Histórico e exportação

**Ações → Histórico** apresenta entradas, consumo, descarte, ajustes históricos e conferências. Movimentos novos mostram saldo anterior e posterior. Registros anteriores continuam legíveis sem exigir campos novos retroativamente.

**Exportar** reúne:

- **Todos os lotes (CSV)**: código, material, lote, validade, unidade, saldo, situação e última conferência.
- **Histórico (CSV)**: eventos, quantidades, saldos antes/depois quando disponíveis, motivos e responsável registrado. Datas dos arquivos usam ISO; horários incluem o fuso UTC no timestamp.
- **Backup (JSON)**: Cadastro e todos os registros de validade. A restauração ainda não está disponível pela interface.

Os CSVs exportam o conjunto completo, independentemente dos filtros visuais. O formulário não solicita responsável; enquanto não houver autenticação, novos eventos usam “Operador local”. Responsáveis antigos são preservados.

## Unidades e persistência

Grafias explícitas são padronizadas, como `kg → KG` e `UNID → UN`, sem converter quantidades ou deduzir unidades pela descrição. **Cadastro → Mais ações → Conferir unidades** ajuda a comparar a base com o MXM. Lotes mantêm a unidade registrada; exclusão do material e troca de unidade são bloqueadas quando há vínculos, inclusive encerrados. Inativação preserva o histórico.

Persistência atual: navegador, chave `suprimentos:expiry:v1`, por `LocalExpiryRepository`, separado da interface React. A leitura valida o saldo pelo histórico e preserva registros antigos. Falhas de armazenamento mantêm a edição; conflito entre abas bloqueia sobrescrita. Dados inconsistentes são preservados e impedem gravações. Essa proteção local não substitui transações e autenticação de servidor.

Firebase, regras de acesso e publicação são etapas posteriores. Não houve migração de dados demonstrativos para produção; o histórico real começa com os registros feitos no ambiente publicado.

## Pesquisa utilizada

Foram consultados os arquivos oficiais das documentações, mantidos nos repositórios dos fabricantes:

1. [Odoo — lotes e rastreabilidade](https://github.com/odoo/documentation/blob/19.0/content/applications/inventory_and_mrp/inventory/product_management/product_tracking/lots.rst): material central, vários lotes e uso de lotes existentes em novos recebimentos.
2. [Odoo — validades](https://github.com/odoo/documentation/blob/19.0/content/applications/inventory_and_mrp/inventory/product_management/product_tracking/expiration_dates.rst) e [FEFO](https://github.com/odoo/documentation/blob/19.0/content/applications/inventory_and_mrp/inventory/shipping_receiving/removal_strategies/fefo.rst): alertas e prioridade dos vencimentos mais próximos.
3. [Odoo — contagem e ajustes](https://github.com/odoo/documentation/blob/19.0/content/applications/inventory_and_mrp/inventory/warehouses_storage/inventory_management/count_products.rst): diferença entre saldo e contagem física, confirmação antes de aplicar e histórico inclusive com diferença zero.
4. [Microsoft Dynamics — contagem cíclica](https://github.com/MicrosoftDocs/dynamics-365-unified-operations-public/blob/main/articles/supply-chain/warehousing/cycle-counting.md): conferência pontual e tratamento de divergências.

A adaptação mantém apenas as operações necessárias para este módulo. Configurações de armazéns, ordens de compra, aprovações e notificações externas descritas pelos fornecedores não foram adicionadas.

## Visualização por Tipo e Local

O filtro **Tipo** contém Todos, Gêneros alimentícios, Bebidas, Higiene e Limpeza e Segurança e Proteção. Em Todos, a listagem mantém seções separadas por tipo. Pesquisa e situação continuam disponíveis. Os indicadores e a conferência coletiva respeitam o tipo/local selecionado.

A classificação usa Tipo, Grupo e prefixo do código do Cadastro, seguindo as regras abaixo. Lotes novos guardam a classificação. Registros antigos fora das regras permanecem em Todos e em **Sem classificação**, com saldo e histórico preservados. Para novos registros, a busca oferece somente materiais enquadrados; a correção de Tipo/Grupo deve ser feita no Cadastro, sem classificar manualmente pelo formulário de validade.

Somente em Bebidas aparece o filtro **Local**: Todos, Almoxarifado e Lanchonete. O cadastro de uma bebida também permite escolher o local, aproveitando o local da visualização. Registros antigos de bebidas são apresentados no Almoxarifado por padrão, sem regravação automática ao ler. Esse local é materializado quando ocorre uma operação. Ao expandir um material, os lotes de bebidas mostram Local; entradas, baixas e conferências operam somente na posição escolhida. A prioridade de consumo considera os lotes do mesmo local.

**Ações → Transferir para Lanchonete** aparece exclusivamente em bebidas com saldo no Almoxarifado. Basta informar a quantidade. A operação reduz o saldo da origem e soma na Lanchonete, mantendo material, lote, validade e unidade. Reutiliza a posição de destino quando já existe, inclusive zerada. A transferência não é consumo e não altera o total entre os dois locais.

Saída e entrada são vinculadas pelo identificador da transferência e gravadas juntas. Excesso, operação repetida, outro tipo e direção inversa são bloqueados. O leitor exige o par completo, quantidades iguais e locais corretos. Histórico e CSV identificam local, tipo e transferência; os dois lados permanecem rastreáveis. Um lote físico presente nos dois locais conta uma única vez nos indicadores; a capa identifica que há dois locais.


### Regras de elegibilidade da busca

- **Gêneros alimentícios:** tipo de gêneros/alimentos, excluindo os grupos de bebidas.
- **Bebidas:** grupo BEBIDAS ALCOÓLICAS ou BEBIDAS NÃO ALCOÓLICAS, ou prefixos 1305/1306 no código MXM (com ou sem ES) ou no campo Grupo. O tipo base Gêneros não impede esse enquadramento. O rótulo Bebidas sozinho não admite materiais de outros grupos.
- **Higiene e Limpeza:** itens desse tipo, excluindo a exceção de solares.
- **Segurança e Proteção:** itens desse tipo e o grupo PROTETORES OU BLOQUEADORES SOLARES, mesmo que o tipo base seja Higiene e Limpeza.

As regras valem para pesquisa, visualização, gravação, classificação dos relatórios e transferência. A classificação atual do Cadastro prevalece sobre um enquadramento antigo do lote; consultar não regrava saldos ou eventos. Palavras de descrição como “cerveja” não tornam um utensílio uma bebida. Em Todos, a busca de registro reúne somente materiais elegíveis nas quatro categorias; em um tipo específico, só oferece a categoria escolhida.
