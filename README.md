# Sair das Dívidas

Aplicativo web responsivo, dark-first, para organizar dívidas pessoais, renda, despesas essenciais, pagamentos e planejamento mensal.

## Executar localmente

```bash
python3 -m http.server 4173
```

Abra `http://localhost:4173`.

## Persistência
- MVP publicado: IndexedDB no navegador.
- Produção multi-dispositivo: PostgreSQL/Supabase em `database/schema.sql`.

## Regras centrais
- Cartão de crédito é prioridade padrão.
- Planejamento não altera saldo real.
- Somente renda `received` entra no dinheiro disponível.
- Somente pagamentos `confirmed` reduzem dívida.
- Valores financeiros são armazenados em centavos inteiros.
- Tema escuro é padrão obrigatório.
