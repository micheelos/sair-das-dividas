import test from 'node:test';
import assert from 'node:assert/strict';
import { debtBalance, totals } from '../finance.js';

test('pagamento confirmado reduz saldo',()=>{
  const d={id:'d1',originalCents:120000};
  assert.equal(debtBalance(d,[{debtId:'d1',amountCents:20000,status:'confirmed'}]),100000);
});

test('planejado não reduz saldo',()=>{
  const d={id:'d1',originalCents:120000};
  assert.equal(debtBalance(d,[{debtId:'d1',amountCents:20000,status:'planned'}]),120000);
});

test('renda prevista não entra no disponível',()=>{
  const r=totals({debts:[],payments:[],expenses:[],incomes:[{amountCents:500000,status:'expected'}]});
  assert.equal(r.available,0);
});

test('essenciais pagos e pagamentos confirmados reduzem disponível',()=>{
  const r=totals({
    debts:[{id:'d1',originalCents:100000}],
    incomes:[{amountCents:300000,status:'received'}],
    expenses:[{amountCents:50000,status:'paid'}],
    payments:[{debtId:'d1',amountCents:20000,status:'confirmed'}],
    reserveCents:30000
  });
  assert.equal(r.available,230000);
  assert.equal(r.plannable,200000);
  assert.equal(r.currentDebt,80000);
});
