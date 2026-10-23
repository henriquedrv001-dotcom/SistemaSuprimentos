# Publicação 1.0 — Cadastro e Validades com Neon

## Hospedagem completa e custos

O Neon hospeda o banco PostgreSQL. O site e a API precisam de hospedagem própria: a configuração deste repositório usa um único Web Service Node no Render para ambos. O Codespace é ambiente de desenvolvimento e não é a hospedagem da versão publicada.

São duas contas: Neon para dados e Render para executar o sistema. O `render.yaml` solicita o plano Free do Render. Isso não garante operação sem limites ou gratuidade permanente: conferir condições, cotas e preços apresentados pelos dois fornecedores antes de contratar. O serviço gratuito do Render pode suspender por inatividade e demorar para responder ao próximo acesso. Para uso diário, avaliar uma instância paga que permaneça ativa. Nenhum plano pago deve ser contratado automaticamente.

### Próximo passo no painel

1. Entrar em https://dashboard.render.com e conectar a conta do GitHub.
2. Escolher **New → Web Service**, conectar `henriquedrv001-dotcom/SistemaSuprimentos` e selecionar a branch que contenha o commit de lançamento. Confirmar antes que os commits locais foram enviados ao GitHub.
3. Usar as configurações da seção 3 abaixo e escolher explicitamente o plano desejado. Não criar um Static Site: este sistema precisa executar a API Node.
4. Preencher `DATABASE_URL` no campo de variável de ambiente do Render, usando a conexão copiada do Neon. Não compartilhar esse valor no chat ou no repositório.
5. Preparar as tabelas e o primeiro usuário conforme a seção 2, em terminal autorizado com a conexão configurada em `.env` ignorado pelo Git. O plano gratuito de hospedagem pode não oferecer terminal remoto; o terminal do projeto pode executar essa preparação.
6. Publicar: no Render o servidor usa automaticamente `RENDER_EXTERNAL_URL`, fornecida pela plataforma. Não é necessário informar `APP_ORIGIN` na primeira publicação. Validar `/api/health`, login, Cadastro e Validades antes de disponibilizar aos usuários.

Criar o projeto no Neon, sozinho, não publica o sistema. A publicação só está concluída após esses testes no endereço real da hospedagem.

## Entrega preparada

A aplicação possui duas formas de execução:

- **Desenvolvimento local:** `npm run dev`, sem `VITE_APP_MODE=production`, mantém o protótipo e seus módulos atuais no navegador.
- **Versão de lançamento:** `npm run build:release` gera login e acesso somente a Cadastro e Validades. `npm start` executa a API e, em produção, serve esse frontend no mesmo endereço. Não há cadastro público nem migração automática de dados do navegador.

A versão conectada começa vazia. Os materiais reais serão importados por CSV/TXT depois da publicação, como definido para o lançamento. O Cadastro existente e os serviços de Validades foram reaproveitados. Os demais módulos continuam no repositório para desenvolvimento, sem navegação ou endpoints na versão publicada.

## Arquitetura

Navegador → API Node/Express → PostgreSQL no Neon. As interfaces usam `RemoteRepository`; a senha do banco fica somente no servidor em `DATABASE_URL`. Não usar prefixo `VITE_` para credenciais.

A API valida e executa os comandos de Cadastro e Validades, usando as regras de domínio existentes. Quantidades, tipos/grupos, validade, transferências e conferências são conferidos no servidor. Nome do operador vem da sessão autenticada, não do formulário.

O banco possui materiais, histórico, lotes, movimentos, usuários, sessões e auditoria. Chaves estrangeiras preservam os vínculos. Exclusão de material é lógica, retendo seu histórico; material com lote vinculado não pode ser excluído. Os eventos são protegidos contra UPDATE/DELETE. Importações usam gravação em lote, evitando uma consulta por produto.

Uma revisão compartilhada é conferida sob bloqueio de transação: quem salva sobre uma revisão antiga recebe conflito, sem sobrescrever outra pessoa. Para este início com poucos usuários, o bloqueio abrange Cadastro e Validades juntos. Não há mesclagem automática de edições concorrentes; conferir/recarregar os dados antes de reaplicar uma alteração é necessário.

## 1. Criar o Neon

1. Criar a conta em https://neon.com e um projeto PostgreSQL destinado à produção.
2. Copiar a string de conexão PostgreSQL oferecida pelo Neon, com TLS. Não enviá-la pelo chat nem colocá-la no GitHub.
3. Criar outro banco/branch para desenvolvimento e testes; nunca apontar `TEST_DATABASE_URL` para produção.
4. No ambiente que preparará o banco, criar `.env` com base em `.env.example` e preencher `DATABASE_URL`. Esse arquivo é ignorado pelo Git.

A conexão usa `pg`, com validação do certificado TLS para hosts externos. Não é necessário instalar SDK específico do Neon. Node 24 ou superior é requerido.

## 2. Preparar o banco e os usuários autorizados

No terminal do projeto, com `.env` preenchido:

```bash
npm ci
npm run db:migrate
npm run user:create -- --email seu-email@dominio.com --name "Seu nome" --role admin
```

A senha é solicitada sem eco no terminal, com mínimo de 12 caracteres. Para usuários adicionais, repetir com `--role editor` ou `--role reader`.

- **admin/editor:** Cadastro e operações de Validades.
- **reader:** consulta, histórico e exportação. Não grava, mesmo se tentar acessar a API diretamente.

A administração de contas é feita por CLI nesta etapa. Não há tela de recuperação pública de senha. Para redefinir uma senha:

```bash
npm run user:create -- --email usuario@dominio.com --reset-password
```

A redefinição encerra as sessões anteriores daquele usuário. Para execução sem terminal interativo, a CLI aceita `BOOTSTRAP_PASSWORD` por variável secreta; não adicionar essa variável ao frontend nem ao repositório.

## 3. Hospedar no Render

Há um `render.yaml` revisável para um único serviço Node, com publicação automática desligada. Criar um serviço no Render ligado a este repositório e à revisão que será lançada.

Configuração equivalente no painel:

- Runtime: Node 24.
- Build: `npm ci --include=dev && npm run build:release`.
- Start: `npm start`.
- Health check: `/api/health`.
- `NODE_ENV=production`.
- `DATABASE_URL`: segredo copiado do Neon de produção.
- `APP_ORIGIN`: opcional no Render, pois o servidor usa `RENDER_EXTERNAL_URL` automaticamente. Definir com o endereço HTTPS exato ao usar domínio próprio ou outra hospedagem.

Aplicar as migrações antes da primeira publicação. O processo não semeia materiais, usuários demonstrativos ou lotes automaticamente. Um build comum do protótipo não inicia em produção: o servidor exige o marcador produzido por `build:release`.

O `--include=dev` é necessário na instalação do build mesmo com `NODE_ENV=production`: TypeScript, Vite e os tipos do React são dependências de compilação. O servidor continua executando em modo de produção.

A API e o frontend compartilham o endereço; não habilitar CORS para origens arbitrárias. Ao mudar para domínio próprio, atualizar `APP_ORIGIN` e republicar/reiniciar.

## 4. Autenticação e sessões

E-mail e senha, apenas para contas criadas pela CLI. As senhas são derivadas com scrypt e salt aleatório; não são guardadas em texto. A sessão usa token aleatório em cookie HttpOnly, SameSite Strict e Secure em produção. O banco guarda somente o hash desse token; expiração em 12 horas e logout invalidam a sessão. Tentativas de login são limitadas no banco. Alterações exigem origem válida e JSON. A conta ativa e o perfil são conferidos a cada requisição.

## 5. Backup e recuperação

Na versão conectada, **Mais ações → Exportar backup**, no Cadastro, ou **Exportar → Backup (JSON)**, em Validades, busca um snapshot consistente do servidor. Inclui Cadastro, materiais arquivados, histórico, lotes e movimentos; não inclui senhas nem sessões.

Guardar cópias fora da hospedagem e testar a recuperação em ambiente separado. Restauração administrativa, somente em banco vazio já preparado com migrações e um administrador:

```bash
npm run db:restore -- /caminho/backup.json email-do-administrador@dominio.com
```

A restauração valida referências e histórico e é transacional. Recusa substituir um banco com dados. Preserva nomes e registros dos operadores originais; registra quem executou a restauração. Usuários e senhas não são restaurados pelo arquivo de negócio e precisam ser autorizados separadamente. Backups antigos do protótipo não são importados por esse comando.

## Desenvolvimento conectado

Preencher `.env` com banco de desenvolvimento e `VITE_APP_MODE=production`. Em terminais separados:

```bash
npm run dev:api
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

O Vite encaminha `/api` para a API local na porta 3001. O protótipo continua acessível quando a opção `VITE_APP_MODE` não está definida. Dados de negócio locais não são lidos nem sobrescritos pela versão conectada; apenas preferências visuais continuam no navegador.

## Verificação antes de liberar

- `npm test`: regras de domínio e testes sem banco externo.
- `TEST_DATABASE_URL=... npm run test:api`: integração com banco exclusivamente de teste, incluindo autenticação, perfis, concorrência, rollback, transferência, histórico imutável e restauração em schema separado.
- `npm run build:release`: build da versão publicada.
- No ambiente de homologação: entrar com dois usuários, importar materiais, registrar vários lotes, transferir bebidas, dar baixa, conferir quantidade real e exportar backup. Testar sessão encerrada, acesso de consulta e falha de conexão sem perder preenchimento.

A implementação foi validada em PostgreSQL 16 isolado. Uma conexão real com o Neon e uma publicação no Render ainda precisam ser configuradas e verificadas com as contas do responsável. Nenhum recurso externo foi criado ou publicado automaticamente.
