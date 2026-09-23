# AGENTS.md — Sair das Dívidas

## Produto
Aplicativo pessoal para sair das dívidas com baixa carga cognitiva.

## Regras imutáveis sem autorização
1. Tema escuro é o padrão.
2. Cartão é prioridade de dívida padrão, após proteger essenciais/reserva.
3. Planejado != pago. Nunca reduzir saldo por planejamento.
4. Renda prevista != dinheiro disponível.
5. Pagamento parcial reduz apenas o valor confirmado.
6. Sem linguagem de culpa, gamificação agressiva ou alarmismo.
7. Valores monetários em centavos inteiros ou decimal exato no servidor.

## UX
- Mobile first.
- Fluxos de cadastro e pagamento curtos.
- Estados sempre por texto + cor/ícone.
- Acessibilidade e teclado.
- Não lotar dashboard com gráficos.

## Dados
MVP usa IndexedDB (`db.js`). Banco de produção está em `database/schema.sql` para PostgreSQL/Supabase com RLS.

## Validação mínima antes de publicar
- Abrir dashboard sem erro.
- Cadastrar dívida única, parcelada/flexível/cartão.
- Registrar renda recebida e prevista.
- Registrar essencial pago/reservado.
- Registrar pagamento parcial e integral.
- Conferir cálculos do disponível e saldo.
- Salvar planejamento sem alterar saldo real.
- Exportar/importar backup.
- Testar layout móvel e desktop.
