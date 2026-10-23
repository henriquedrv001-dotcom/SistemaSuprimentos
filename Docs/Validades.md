# Validades — primeira implementação

Validades é acessado pela barra lateral e usa o mesmo `item.id` do Cadastro central. Não cria outro cadastro de produtos. Cada material pode ter vários lotes, com quantidade, unidade e data de validade próprias. Os demais módulos continuam disponíveis no ambiente de desenvolvimento.

## Operação

1. Em Validades, clique em **Registrar validade**, encontre um material ativo do Cadastro e informe lote, validade, quantidade e responsável.
2. **Salvar e adicionar outro** mantém o material e o responsável, limpando somente os campos do próximo lote. Também é possível selecionar um material no Cadastro e usar **Preparar seleção → Registrar validade**.
3. O painel mostra lotes com saldo: vencidos, até 7 dias, de 8 a 30 dias e acima de 30 dias. Vencimento de hoje permanece no prazo. A lista ordena os mais próximos primeiro e permite pesquisar código, descrição ou lote.
4. **Dar baixa** registra consumo, descarte ou ajuste redutor, com quantidade, motivo e responsável. Não aceita quantidade acima do saldo. Lotes zerados continuam disponíveis pelo filtro **Encerrado**, com seu histórico.
5. **Exportar backup** baixa o Cadastro e os registros de validade em JSON. Não há restauração pela interface nesta etapa.

O saldo dos lotes é independente dos saldos de DLs, pedidos e do MXM. Não há movimentação automática nesses módulos. Os responsáveis são informados pelo operador; ainda não representam identidades autenticadas.

## Unidades e integridade

A exibição e os próximos salvamentos padronizam grafia e abreviações explícitas, como `kg → KG` e `UNID → UN`. Não convertem quantidades nem deduzem KG, UN, CX ou PCT pela descrição. Cadastro → **Mais ações → Conferir unidades** mostra grafias existentes, campos vazios e exemplos para conferência com o MXM. Dados antigos não são regravados apenas por abrir a tela.

Lotes guardam a unidade do momento do registro. Mudanças de unidade e exclusão de materiais com lotes vinculados são bloqueadas, inclusive após encerramento; inativar o material preserva os vínculos. Quantidades usam inteiros com três casas decimais. A mesma combinação material/lote/validade não pode ser registrada novamente. Histórico e saldo são validados juntos antes de salvar.

## Persistência e publicação

Nesta etapa os dados continuam no navegador, na chave `suprimentos:expiry:v1`. `LocalExpiryRepository` implementa a interface `ExpiryRepository`; componentes não acessam SDK de banco de dados. A integração com Firebase, autenticação, regras de acesso e publicação fica para a etapa de infraestrutura, antes do uso compartilhado em produção.

Falhas de armazenamento mantêm a edição aberta. Mudanças em outra aba bloqueiam sobrescrita por uma revisão antiga. Dados de validade inconsistentes são preservados e bloqueiam novas gravações. Essa verificação local não substitui transações de banco de dados.

Nenhuma migração dos dados demonstrativos para produção foi executada. Os dados e o histórico reais começarão quando os materiais forem carregados no ambiente publicado.

## Verificação

Testes de domínio cobrem unidades, vínculo com o Cadastro, múltiplos lotes, duplicidade, validade, quantidades, baixas parciais e totais, histórico, conflito entre abas e falha de armazenamento. O fluxo foi conferido no Chromium nos temas claro e noturno, com persistência após recarregar, exportação e telas estreitas.
