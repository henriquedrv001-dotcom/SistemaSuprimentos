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
A interface é um protótipo de navegação com dados demonstrativos. O formulário de novo item altera somente o estado da página e não grava no banco. Os exemplos de PDL/pedido ERP são ilustrativos.

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
