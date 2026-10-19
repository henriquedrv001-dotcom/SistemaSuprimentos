# Aquisições — implementação pelas referências originais

## Referências fornecidas pelo usuário em 19/10/2026

- Imagem 1: prancha 01, padrão geral de navegação, tipografia, cores e tabelas. Catálogo e Tarefas não são alvo desta rodada.
- Imagem 2: prancha 03, quadros 09–12: Processo, Contratação, Cronograma e Histórico da DL.
- Imagem 3: prancha 04, quadros 13–14: Controle e painel do item. Quadros 15–16, Pedidos e Acompanhamento, pertencem a etapas posteriores.
- Imagem 4: prancha 02, quadros 07–08: lista de Aquisições e materiais da DL. Quadros 05–06, Ciclos, pertencem a etapas posteriores.

Essas referências originais substituem as propostas posteriores geradas pelo assistente. Não há aprovação para excluir informações importantes, esconder justificativa ou parâmetros do cronograma, inventar movimentos, alterar perfis funcionais ou reescrever regras de cálculo. Os dados fictícios e os rótulos de perfis dos desenhos não substituem as regras existentes.

## Etapas

1. Lista e estrutura de detalhe/material: primeiro checkpoint implementado e conferido nesta sessão.
2. Processo, Contratação, Cronograma e Histórico: checkpoint 2 implementado e validado; revisão conjunta ainda pendente.
3. Controle e painel do item: checkpoint 3 implementado e validado.
4. Revisão técnica conjunta e validação final: concluídas nesta sessão. Aceite visual do usuário e sincronização continuam pendentes.

## Checkpoint 1

Lista com ação Nova DL no cabeçalho, filtros de busca/situação/categoria e ordenação por recentes/antigas/número; consulta com ícone. Materiais e valor final não foram apagados: quantidade de materiais acompanha o objeto e contratação final acompanha o orçamento na linha. A ordenação trabalha em cópia filtrada e não regrava os planos.

Detalhe com título e situação, faixa de dados com ícones, justificativa visível e navegação Materiais/Processo/Contratação/Cronograma/Histórico. Mantidos campos editáveis no rascunho, confirmação de fechamento/reabertura e bloqueio posterior. Reabertura está em Mais ações conforme a referência; o controle de alterações pendentes permanece. Acesso ao cronograma continua também no botão.

Tabela de materiais compactada, sem excluir código ou especificação: dados continuam visíveis junto ao material, com total previsto no rodapé e painel de consulta por item. O painel usa os valores em edição, identifica alterações não salvas e não grava dados. Quantidades, preços, moeda, quantidade fracionada, unidade histórica e validações usam os mesmos serviços. Unidade não se tornou campo de edição nesta tela.

Retirados os recolhimentos não aprovados da justificativa e dos campos do cronograma/autorização. As validações, cálculos, assinaturas e origem dos saldos não mudaram. A reorganização visual completa do cronograma pertence à etapa 2.

CSS de Aquisições isolado em src/components/dl/Acquisitions.css. Em App.tsx, acrescentado apenas atributo de apresentação para limitar o fundo às áreas de Aquisições; comportamento e armazenamento das demais funções não foram alterados.

## Evidências do checkpoint

- Build de produção e TypeScript aprovados durante esta rodada.
- 128 testes existentes aprovados.
- Chromium: filtros combinados, ordenação, limpeza, contagens, valores finais visíveis, abrir DL sem regravação, justificativa visível, todos os campos do cronograma acessíveis, cálculo/salvamento do abastecimento e preservação da contratação; desktop, tablet e celular.
- Chromium: total previsto com quantidade decimal, painel com valores não salvos, subtotal, consulta sem escrita, Escape, ações de edição bloqueadas em consulta, olho disponível no planejamento fechado, versão móvel.
- Capturas locais: /workspace/aquisicoes-etapa1-lista.png, /workspace/aquisicoes-etapa1-detalhe.png e /workspace/aquisicoes-etapa1-materiais.png. São evidências de trabalho, não aprovação visual final do usuário.
- Scripts locais: /workspace/onboarding-tools/acquisitions-reference-stage1.cjs e acquisitions-material-consult.cjs. Não integram as dependências do aplicativo.

Nenhum serviço, tipo de domínio, chave de armazenamento ou integração corporativa foi modificado. Este checkpoint não significa que toda a função Aquisições esteja concluída. Envio ao GitHub somente por solicitação de sincronização.

## Checkpoint 2 — Processo, Contratação, Cronograma e Histórico

- Processo com seis linhas numeradas, contexto resumido e perfil funcional previsto. Papéis reais mantidos: estoque em justificativa/análise/aprovação; aprendiz em requisição/fornecedores; compradora em pedido. Os chips não introduzem autenticação nem permissões de servidor. Conteúdo das etapas, validações e ações existentes preservados.
- Contratação com resumo financeiro, diferença percentual quando há base válida, dados contratuais completos, números MXM de todas as origens, anexos em área própria e total da contratação no rodapé. Diferença acima do previsto não é apresentada como economia. Atalho Ver processo usa a navegação existente.
- Visualizar e Baixar na consulta reutilizam os mesmos documentos e serviços locais. Ausência do arquivo original continua sendo erro explícito, sem gerar arquivos fictícios nem apagar metadados.
- Cronograma com Abastecimento/Prazos/Acompanhamento à vista, sem recolhimento dos parâmetros ou da autorização. Marcos e vigência separados do formulário. Mantidos dados automáticos, calendário e regra de dias úteis existentes.
- Histórico com título e filtro na mesma faixa, descrições sem reticências e responsáveis/datas legíveis, mantendo os detalhes expansíveis aprovados e a leitura dos eventos antigos.

Validação: build e 128 testes aprovados; percurso Chromium completo com rascunho da requisição, envio, devolução obrigatória com motivo, correção, reenvio, cancelamento de aprovação, análise, registro de dois anexos, contratação automática, fornecedores, envio para aprovação, checkbox e confirmação/cancelamento finais. Nenhum saldo antes da confirmação final; uma origem após concluir. Conferidos PDF/imagem, download sem alteração do workspace, filtro/detalhes do histórico sem escrita, comparação fora do fieldset do cronograma e todas as abas em desktop/tablet/celular sem transbordamento global.

Script local: /workspace/onboarding-tools/acquisitions-reference-flow.cjs. Capturas: /workspace/aquisicoes-etapa2-processo.png, aquisicoes-etapa2-contratacao.png, aquisicoes-etapa2-cronograma.png e aquisicoes-etapa2-historico.png.

Adequação de Controle/painel do item e revisão visual conjunta continuam pendentes. Nada deste checkpoint foi enviado ao GitHub.


## Checkpoint 3 — Controle e painel lateral do item

Controle com quatro indicadores, regra de saldo baixo explícita e ressalva dos saldos iniciais permanentemente visível. Mantidos busca, situação, fornecedor, categoria, ordenação por DL/fornecedor/item/saldo, sentido de ordenação, opção de zerados e consultas dos indicadores. Cabeçalhos e saldos seguem o padrão da referência; a linha mostra o item sem duplicar código e objeto, que continuam no painel lateral.

Painel lateral com título, código, DL/objeto, quantidade, unidade histórica, fornecedor, pedido MXM, contratação, vigência, especificação e saldo em destaque. Rodapé com Fechar/Consultar DL. Área de movimentos identifica a ausência de integração; não inventa baixas, recebimentos ou datas de último pedido. Nova DL no Controle reutiliza o mesmo cadastro e encaminha ao planejamento; cancelar não consome número.

Validação Chromium: mesmo material em origens de DLs diferentes; unidade histórica KG e quantidade decimal; MXM com zeros à esquerda; filtros, sentido de ordenação, três consultas dos indicadores; fechamento por Escape; painel no limite direito e altura inteira; consulta da DL e retorno preservando filtros; tablet/celular sem transbordamento da página; consultas sem escrita; cancelamento e criação de DL a partir do Controle.

Script local: /workspace/onboarding-tools/acquisitions-reference-control.cjs. Capturas reais: /workspace/aquisicoes-etapa3-controle.png e aquisicoes-etapa3-item.png.

## Fechamento técnico desta rodada

As oito vistas de Aquisições das referências originais foram adequadas: lista, materiais, processo, contratação, cronograma, histórico, controle e detalhe do item. Revisados layout e informações visíveis. Código/especificação de materiais e valores finais foram mantidos, mesmo quando não aparecem no desenho ilustrativo. Os textos de perfis, cálculos e anexos usam a aplicação real.

- 128 testes existentes aprovados, sem falhas.
- Build de produção e TypeScript aprovados.
- Percursos de navegador de lista/materiais, fluxo completo e Controle aprovados; desktop, tablet e celular.
- Comparação dos estilos computados com/sem a folha de Aquisições confirmou isolamento em Visão geral, Catálogo, Ciclos, Tarefas, Pedidos e Acompanhamento (script local acquisitions-scope-review.cjs).
- Nova conferência de cabeçalhos e consulta dos materiais, com capturas aquisicoes-revisao-materiais.png e aquisicoes-revisao-contratacao.png.

Este fechamento é técnico, não substitui o aceite visual do usuário nem afirma ausência absoluta de defeitos. As alterações permanecem locais até solicitação explícita de sincronização. Pedidos, Acompanhamento, Ciclos, Catálogo e Tarefas não foram reformulados nesta rodada. Baixas diretas, movimentos do ERP e autenticação por perfil continuam fora desta alteração visual.

## Rodada seguinte — cabeçalho e modelos de filtros

Por solicitação do usuário: título **PROCESSOS DE COMPRA** em Planejamento e Controle; alternância segmentada no topo, ao lado de Nova DL; remoção da antiga faixa de abas dessas duas vistas. Navegação, proteção de alterações e ações mantidas.

Corrigida a composição dos filtros, que herdava larguras fixas e causava sobreposição. Busca e caixas compartilham altura de 38 px, rótulos alinhados e grade responsiva pela largura do conteúdo. As caixas de seleção dos filtros de Planejamento, Controle e Histórico usam o novo modelo com lista própria, indicação da seleção, teclado, digitação por prefixo, rolagem e posicionamento acima/abaixo. A antiga regra de largura do botão de ordenação foi limitada ao botão de sentido, preservando a largura do seletor.

Modelos registrados em [Modelos de interface](Modelos%20de%20interface.md), com componentes em `src/components/ui`. Aplicação a outras funções somente quando solicitada. Os seletores que editam formulários não foram convertidos em filtros.

Conferência: 128 testes existentes aprovados; build/TypeScript; Chromium com mouse, teclado (incluindo palavras com acentos), toque, fechamento por Escape/Tab/clique externo, filtros combinados, limpeza, ordenação, zerados e histórico. Geometria dos campos conferida de 320 a 1920 px, sem sobreposição/transbordamento da página; popup verificado com pouca altura disponível. Consulta/filtros não regravaram o workspace de teste. Capturas locais `processos-compra-planejamento.png`, `processos-compra-controle.png`, `processos-compra-lista-opcoes.png` e `processos-compra-mobile.png` usam dados de teste.

Esta rodada permanece aguardando avaliação visual e pedido de sincronização.

## Rodada seguinte — solicitante, seletor de materiais e total previsto

- Nome padrão editável: ANTÔNIO HENRIQUE CAVALCANTE FREIRE. Novas DLs já recebem o nome; rascunhos vazios mostram a sugestão sem gravar automaticamente. Nomes preenchidos são preservados. Alteração e limpeza explícitas são respeitadas ao salvar; planos fechados não recebem preenchimento retroativo.
- Seletor de materiais da DL como janela ampla, com busca/Tipo/Grupo na mesma faixa em desktop. Mesmos filtros do catálogo de modelos, checkboxes de 18 × 18 px e estado parcial. Conteúdo da lista ocupa a área restante e rola independentemente.
- Fechar e Adicionar selecionados no topo; Cancelar removido somente desta apresentação. Anterior/Página N de M/Próxima ficam no rodapé. Regras de filtragem, exclusão de já incluídos, seleção e paginação continuam as mesmas. A apresentação do seletor em Ciclos não foi reformulada.
- Total previsto permanece no canto inferior direito, com valor destacado e pendências em texto próprio. Identificação Parcial e explicação da base da soma. O resumo fica fora da rolagem horizontal da tabela, para manter o valor visível também no celular. Erro de digitação não vira zero e o orçamento não vira saldo contratado.

Validação: build/TypeScript e 128 testes existentes; Chromium com 1646 materiais disponíveis e 33 páginas, itens inativos/já incluídos excluídos, seleção entre páginas e de todos os resultados, dependência Tipo/Grupo, filtros dentro de diálogo modal, Escape, fechar sem salvar/incluir, inclusão sem duplicar e sem perder quantidades/preços não salvos. Nome sugerido, edição, limpeza, gravação e preservação dos nomes anteriores conferidos. Totais parciais de R$ 1.849,00, um/dois materiais pendentes, total completo de R$ 6.169,00 e erro de valor inválido conferidos. Geometria de desktop/celular, dimensões dos checkboxes, altura aproveitada e ações no topo/rodapé verificadas. Smoke test de Ciclos confirmou filtros nativos/ações anteriores, cancelamento sem escrita e inclusão correta no ciclo.

Modelos UI-CHK-01, UI-PICK-01 e UI-SUM-01 registrados em Modelos de interface.md. Capturas locais usam dados de teste: dl-seletor-amplo.png, dl-seletor-mobile.png, dl-total-parcial-limpo.png, dl-total-completo-limpo.png e dl-total-mobile-limpo.png. Alterações locais, aguardando pedido de sincronização e avaliação visual.
