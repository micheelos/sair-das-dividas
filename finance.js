export const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const toCents = value => Math.round(Number(String(value ?? '').replace(/\./g,'').replace(',','.')) * 100) || 0;
export const fromCents = cents => (Number(cents) || 0) / 100;
export const money = cents => BRL.format(fromCents(cents));
export const todayISO = () => new Date().toISOString().slice(0,10);
export const monthKey = () => new Date().toISOString().slice(0,7);
export const uid = prefix => `${prefix}_${crypto.randomUUID()}`;

export function debtBalance(debt, payments) {
  const paid = payments.filter(p => p.debtId === debt.id && p.status === 'confirmed').reduce((s,p)=>s+p.amountCents,0);
  return Math.max(0, debt.originalCents - paid);
}

export function totals({ debts, payments, incomes, expenses, reserveCents = 0 }) {
  const received = incomes.filter(i=>i.status==='received').reduce((s,i)=>s+i.amountCents,0);
  const essentialPaid = expenses.filter(e=>e.status==='paid').reduce((s,e)=>s+e.amountCents,0);
  const confirmedPayments = payments.filter(p=>p.status==='confirmed').reduce((s,p)=>s+p.amountCents,0);
  const originalDebt = debts.reduce((s,d)=>s+d.originalCents,0);
  const currentDebt = debts.reduce((s,d)=>s+debtBalance(d,payments),0);
  const available = received - essentialPaid - confirmedPayments;
  return {
    received, essentialPaid, confirmedPayments, originalDebt, currentDebt,
    paidDebt: originalDebt-currentDebt,
    available,
    plannable: Math.max(0, available-reserveCents)
  };
}

export function priorityDebt(debts, payments) {
  const open = debts.map(d=>({...d, balanceCents: debtBalance(d,payments)})).filter(d=>d.balanceCents>0 && d.status!=='archived');
  return open.find(d=>d.category==='card') || open.sort((a,b)=>(a.priority??99)-(b.priority??99))[0] || null;
}
