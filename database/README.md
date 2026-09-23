# Banco de dados

## MVP local
A versão web utiliza IndexedDB no navegador para funcionar imediatamente sem servidor ou credenciais.

## Produção
O arquivo `schema.sql` contém a estrutura PostgreSQL/Supabase para a versão multi-dispositivo com autenticação.

### Regras principais
- Cada registro pertence a um `user_id`.
- RLS isola dados entre usuários.
- Saldos são derivados de pagamentos confirmados.
- Planejamentos nunca alteram saldo real.
- Valores monetários usam centavos inteiros (`bigint`).

### Migração futura
Quando Supabase/PostgreSQL estiver conectado:
1. aplicar `schema.sql`;
2. configurar autenticação;
3. substituir o adapter IndexedDB por adapter Supabase;
4. manter as mesmas interfaces de domínio no frontend;
5. oferecer importação do backup JSON local.
