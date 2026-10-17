# Proposta e evolução do sistema

## Objetivo confirmado
Centralizar as informações dos processos de suprimentos da filial para planejar, controlar e acompanhar. O ERP oficial continua responsável pela execução: cotações, estoque, financeiro e demais operações. A ferramenta deve reduzir o uso de planilhas externas e quadros separados. Não presumir integração automática com o ERP: a forma de obter e atualizar informações ainda precisa ser definida.

As telas atuais pertencem ao setor Estoque. Compras será incluído futuramente.

## Organização
Cada tela tem um arquivo em `src/pages/estoque/`. O `App.tsx` organiza a navegação e compartilha o catálogo entre as telas. Elementos de resumo reutilizados ficam em `src/components/Resumo.tsx`.

## Primeira entrega: cadastro de itens
- Campos existentes: código do ERP (único), descrição, unidade, grupo e critério de solicitação.
- Inclusão de itens fictícios, validação de campos obrigatórios e bloqueio de códigos repetidos, desconsiderando maiúsculas/minúsculas e espaços nas extremidades.
- Busca por código, descrição, grupo e critério; apresentação do status do item.
- Dados mantidos somente na sessão da página; navegar entre telas preserva o catálogo, recarregar restaura a demonstração. Ainda não existe gravação definitiva.
- Confirmado: o código deve ser exatamente o do ERP e será a referência principal para relacionar informações. É tratado como texto para preservar zeros à esquerda. O identificador interno é mantido para preservar os vínculos existentes.
- Pendente de validação: os demais campos e critérios atuais atendem ao processo? Não foi estabelecido vínculo automático com o ERP.

## Próximas entregas
Validar uma tela por vez: definir tarefa e regras com o responsável, implementar, testar os fluxos, colher retorno e registrar versões no Git. A gravação definitiva e os acessos dos usuários precisam ser projetados antes do uso com dados reais.

No acompanhamento de pedidos, permitir alternar lista e Kanban usando os mesmos registros e filtros. O Kanban agrupará por status. Exemplos do responsável: PDF-0008 / SEMANA 1 OUT. / LUIZ L. / Solicitado; PDF-0009 / SEMANA 1 OUT. / ANNA KARLA / Recebido. Campos, transições de status e eventual movimentação entre colunas ainda serão definidos. Essa visualização não foi implementada nesta entrega.
