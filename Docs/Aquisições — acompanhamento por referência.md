# Aquisições — implementação pelas referências originais

## Referências fornecidas pelo usuário em 19/10/2026

- Imagem 1: prancha 01, padrão geral de navegação, tipografia, cores e tabelas. Catálogo e Tarefas não são alvo desta rodada.
- Imagem 2: prancha 03, quadros 09–12: Processo, Contratação, Cronograma e Histórico da DL.
- Imagem 3: prancha 04, quadros 13–14: Controle e painel do item. Quadros 15–16, Pedidos e Acompanhamento, pertencem a etapas posteriores.
- Imagem 4: prancha 02, quadros 07–08: lista de Aquisições e materiais da DL. Quadros 05–06, Ciclos, pertencem a etapas posteriores.

Essas referências originais substituem as propostas posteriores geradas pelo assistente. Não há aprovação para excluir informações importantes, esconder justificativa ou parâmetros do cronograma, inventar movimentos, alterar perfis funcionais ou reescrever regras de cálculo. Os dados fictícios e os rótulos de perfis dos desenhos não substituem as regras existentes.

## Etapas

1. Lista e estrutura de detalhe/material: primeiro checkpoint implementado e conferido nesta sessão.
2. Processo, Contratação, Cronograma e Histórico: pendentes de adequação completa às referências.
3. Controle e painel do item: pendentes de adequação completa às referências.
4. Revisão visual conjunta e validação final: pendente.

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
