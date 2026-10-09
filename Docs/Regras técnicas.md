# Regras técnicas do protótipo

## O que esta primeira versão faz
- Apresenta uma interface inicial para painel, cadastro de itens, ciclos, pedidos em aberto e saldos das DLs.
- Usa dados fictícios em memória no frontend.
- Inclui um esquema inicial PostgreSQL/Supabase para revisão.
- Registra a regra de que PDFs precisam ser vinculados ao item licitado específico que identifica o PDL/pedido ERP de origem.

## O que ainda NÃO faz
- Não persiste itens criados na interface: eles desaparecem ao recarregar a página.
- Não grava dados no banco por padrão.
- Não implementa autenticação completa nem políticas de acesso.
- Não calcula compromissos com segurança transacional em concorrência.
- Não integra com o ERP e não gera pedidos corporativos.
- Não deve ser usado com dados reais.

## Próximos passos técnicos
1. Revisar o documento de requisitos com o responsável pelo processo.
2. Instalar dependências e executar localmente.
3. Validar visualmente a navegação e o catálogo.
4. Revisar migrações SQL com desenvolvedor.
5. Definir políticas de compromisso, cancelamento, recebimento e liberação de saldo.
6. Implementar autenticação e Row Level Security antes de qualquer teste com dados corporativos.
7. Conectar formulários ao banco de dados.
8. Implementar transações no backend para reservar e liberar quantidades sem duplicidade.
9. Implementar testes automatizados e backup/restauração.
10. Só então avaliar publicação online.

## Comandos
Requer Node.js LTS instalado.

```bash
npm install
npm run dev
```

Acesse o endereço local que o Vite mostrar no terminal (por padrão http://127.0.0.1:5173).

Para validar compilação:
```bash
npm run typecheck
npm run build
```

## Segurança
- Nunca coloque `service_role` ou segredos no frontend.
- Não publique chaves privadas em Git.
- Use somente dados fictícios durante o protótipo.
- Verifique autorização da TI antes de hospedar ou usar dados corporativos.