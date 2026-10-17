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
