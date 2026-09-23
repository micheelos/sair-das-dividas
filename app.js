import { getAll, put, remove, clearAll, exportAll, importAll } from './db.js';
import { money, toCents, uid, todayISO, monthKey, totals, debtBalance, priorityDebt } from './finance.js';

const state = { debts:[], payments:[], incomes:[], expenses:[], plans:[], settings:[], debtFilter:'active' };
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmtDate = d => d ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${d}T12:00:00`)) : 'Sem vencimento';

async function load() {
  [state.debts,state.payments,state.incomes,state.expenses,state.plans,state.settings] = await Promise.all([
    getAll('debts'), getAll('payments'), getAll('incomes'), getAll('expenses'), getAll('plans'), getAll('settings')
  ]);
  if (!state.settings.find(s=>s.id==='profile')) await put('settings',{id:'profile',reserveCents:0,createdAt:new Date().toISOString()});
  state.settings = await getAll('settings');
  render();
}

function profile(){ return state.settings.find(s=>s.id==='profile') || {reserveCents:0}; }
function calc(){ return totals({...state,reserveCents:profile().reserveCents}); }
function currentPlan(){ return state.plans.find(p=>p.month===monthKey()) || null; }

function render(){
  renderDashboard(); renderDebts(); renderIncome(); renderExpenses(); renderPlanning();
  $('#periodLabel').textContent = new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date());
}

function renderDashboard(){
  const t=calc(); const p=priorityDebt(state.debts,state.payments);
  $('#availableAmount').textContent=money(t.available);
  $('#plannableAmount').textContent=money(t.plannable);
  if(p){
    $('#priorityTitle').textContent=p.name;
    $('#priorityAmount').textContent=money(debtBalance(p,state.payments));
    $('#priorityMeta').textContent = p.dueDate ? `Vencimento: ${fmtDate(p.dueDate)} • ${p.creditor||'Sem credor informado'}` : `${p.creditor||'Sem credor informado'} • sem vencimento fixo`;
    $('#priorityPay').disabled=false; $('#priorityPay').dataset.debtId=p.id;
  } else {
    $('#priorityTitle').textContent='Nenhuma dívida pendente'; $('#priorityAmount').textContent=money(0);
    $('#priorityMeta').textContent='Cadastre sua primeira dívida para começar.'; $('#priorityPay').disabled=true;
  }
  $('#metricGrid').innerHTML = [
    ['Total devido',money(t.currentDebt)],['Pago nas dívidas',money(t.paidDebt)],['Renda recebida',money(t.received)],['Essenciais pagos',money(t.essentialPaid)]
  ].map(([a,b])=>`<div class="metric"><span>${a}</span><strong>${b}</strong></div>`).join('');

  const upcoming=state.debts.map(d=>({...d,balanceCents:debtBalance(d,state.payments)})).filter(d=>d.balanceCents>0).sort((a,b)=>{
    if(a.category==='card'&&b.category!=='card') return -1; if(b.category==='card'&&a.category!=='card') return 1;
    return String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999'));
  }).slice(0,5);
  $('#upcomingList').innerHTML=upcoming.length?upcoming.map(d=>`<div class="list-item"><div class="list-row"><div><div class="item-title">${esc(d.name)}</div><div class="item-meta">${esc(d.creditor||'Sem credor')} • ${fmtDate(d.dueDate)}</div></div><div><strong>${money(d.balanceCents)}</strong></div></div></div>`).join(''):'<div class="empty">Nenhuma pendência cadastrada. Use “Nova dívida” para começar.</div>';
  const pct=t.originalDebt?Math.min(100,Math.round((t.paidDebt/t.originalDebt)*100)):0;
  $('#progressPanel').innerHTML=`<div class="money-xl" style="font-size:36px">${pct}%</div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><div class="progress-copy"><span>${money(t.paidDebt)} pagos</span><span>${money(t.currentDebt)} restantes</span></div>`;
}

function filteredDebts(){
  return state.debts.map(d=>({...d,balanceCents:debtBalance(d,state.payments)})).filter(d=>{
    if(state.debtFilter==='card') return d.category==='card';
    if(state.debtFilter==='paid') return d.balanceCents===0;
    if(state.debtFilter==='active') return d.balanceCents>0 && d.status!=='archived';
    return true;
  }).sort((a,b)=>(a.category==='card'?-1:0)-(b.category==='card'?-1:0) || a.name.localeCompare(b.name));
}

function renderDebts(){
  const rows=filteredDebts();
  $('#debtList').innerHTML=rows.length?rows.map(d=>{
    const paid=d.originalCents-d.balanceCents; const pct=d.originalCents?Math.min(100,Math.round((paid/d.originalCents)*100)):0;
    return `<article class="debt-card">
      <div><div class="item-title">${esc(d.name)}</div><div class="item-meta">${esc(d.creditor||'Sem credor')} • ${labelType(d.type)} ${d.category==='card'?'• prioridade':''}</div><div class="progress-track" style="margin-top:10px"><div class="progress-fill" style="width:${pct}%"></div></div></div>
      <div><div class="item-meta">Saldo atual</div><div class="amount">${money(d.balanceCents)}</div></div>
      <div><div class="item-meta">Vencimento</div><strong>${fmtDate(d.dueDate)}</strong></div>
      <div class="debt-actions"><button class="icon-action" data-pay="${d.id}">Pagar</button><button class="icon-action" data-edit-debt="${d.id}">Editar</button></div>
    </article>`
  }).join(''):'<div class="empty">Nenhuma dívida nesta visão.</div>';
}

function renderIncome(){
  const list=[...state.incomes].sort((a,b)=>String(b.dateReceived||b.dateExpected).localeCompare(String(a.dateReceived||a.dateExpected)));
  $('#incomeList').innerHTML=list.length?list.map(i=>`<div class="list-item"><div class="list-row"><div><div class="item-title">${esc(i.description)}</div><div class="item-meta">${i.status==='received'?'Recebida':'Prevista'} • ${fmtDate(i.dateReceived||i.dateExpected)}</div></div><div style="text-align:right"><strong>${money(i.amountCents)}</strong><div><span class="status ${i.status==='received'?'success':''}">${i.status==='received'?'Recebida':'Prevista'}</span></div></div></div></div>`).join(''):'<div class="empty">Nenhuma renda cadastrada.</div>';
}
function renderExpenses(){
  const list=[...state.expenses].sort((a,b)=>String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999')));
  $('#expenseList').innerHTML=list.length?list.map(e=>`<div class="list-item"><div class="list-row"><div><div class="item-title">${esc(e.description)}</div><div class="item-meta">${fmtDate(e.dueDate)} • ${esc(e.category||'Essencial')}</div></div><div style="text-align:right"><strong>${money(e.amountCents)}</strong><div><span class="status ${e.status==='paid'?'success':'warning'}">${e.status==='paid'?'Paga':'Reservada'}</span></div></div></div></div>`).join(''):'<div class="empty">Nenhuma despesa essencial cadastrada.</div>';
}
function renderPlanning(){
  const t=calc(), plan=currentPlan();
  const open=state.debts.map(d=>({...d,balanceCents:debtBalance(d,state.payments)})).filter(d=>d.balanceCents>0 && d.status!=='archived').sort((a,b)=>a.category==='card'?-1:b.category==='card'?1:0);
  const existing=new Map((plan?.items||[]).map(i=>[i.debtId,i.amountCents]));
  $('#plannerSummary').innerHTML=[['Disponível real',money(t.available)],['Reserva mínima',money(profile().reserveCents)],['Planejável',money(t.plannable)],['Dívidas abertas',String(open.length)]].map(([a,b])=>`<div class="summary-chip"><span>${a}</span><strong>${b}</strong></div>`).join('');
  $('#plannerDebtList').innerHTML=open.length?open.map(d=>`<div class="list-item plan-row"><div><div class="item-title">${esc(d.name)} ${d.category==='card'?'<span class="status">Prioridade</span>':''}</div><div class="item-meta">Saldo ${money(d.balanceCents)}</div></div><div class="field"><label for="plan-${d.id}">Planejar pagamento</label><input id="plan-${d.id}" class="plan-input" data-debt="${d.id}" inputmode="decimal" value="${existing.has(d.id)?(existing.get(d.id)/100).toFixed(2).replace('.',','):''}" placeholder="0,00"></div></div>`).join(''):'<div class="empty">Cadastre dívidas para criar um planejamento.</div>';
  updatePlannedLeftover();
  $$('.plan-input').forEach(i=>i.addEventListener('input',updatePlannedLeftover));
}
function updatePlannedLeftover(){ const sum=$$('.plan-input').reduce((s,i)=>s+toCents(i.value),0); $('#plannedLeftover').textContent=money(calc().available-sum); }

function labelType(t){ return ({single:'Valor único',installment:'Parcelada',flexible:'Flexível',card:'Cartão'})[t]||'Dívida'; }
function esc(s=''){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function toast(msg){ const el=document.createElement('div'); el.className='toast'; el.textContent=msg; $('#toastRegion').append(el); setTimeout(()=>el.remove(),3200); }
function showView(view){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${view}`));
  $$('.nav-item,.mobile-nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  $('#pageTitle').textContent=({dashboard:'Visão geral',debts:'Dívidas',planning:'Planejamento',income:'Renda',expenses:'Despesas essenciais',backup:'Backup'})[view]||'Sair das Dívidas';
  if(view==='planning') renderPlanning();
}

function field(name,label,type='text',extra='',cls=''){ return `<div class="field ${cls}"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" ${extra}></div>`; }
function selectField(name,label,options,cls=''){ return `<div class="field ${cls}"><label for="f-${name}">${label}</label><select id="f-${name}" name="${name}">${options.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div>`; }

function openModal(kind,data={}){
  const form=$('#modalForm'); form.dataset.kind=kind; form.dataset.id=data.id||'';
  $('#modalKicker').textContent=kind==='payment'?'Pagamento':'Cadastro';
  const fields=$('#modalFields');
  if(kind==='debt'){
    $('#modalTitle').textContent=data.id?'Editar dívida':'Nova dívida';
    fields.innerHTML = field('name','Nome da dívida','text',`required value="${esc(data.name||'')}"`)+field('creditor','Credor','text',`value="${esc(data.creditor||'')}"`)+
      selectField('category','Categoria',[['store','Loja'],['person','Pessoa'],['service','Serviço'],['loan','Empréstimo'],['bill','Conta'],['card','Cartão de crédito'],['other','Outro']])+
      selectField('type','Tipo de pagamento',[['single','Valor único'],['installment','Parcelada'],['flexible','Valor flexível'],['card','Cartão de crédito']])+
      field('amount','Valor total','text',`inputmode="decimal" required value="${data.originalCents?(data.originalCents/100).toFixed(2).replace('.',','):''}"`)+
      field('dueDate','Vencimento','date',`value="${data.dueDate||''}"`)+field('installments','Quantidade de parcelas','number',`min="1" value="${data.installments||''}"`)+
      field('priority','Prioridade','number',`min="1" max="99" value="${data.priority||10}"`)+
      `<div class="field full"><label for="f-notes">Observações</label><textarea id="f-notes" name="notes">${esc(data.notes||'')}</textarea></div>`;
    $('#f-category').value=data.category||'store'; $('#f-type').value=data.type||'single';
    $('#f-category').addEventListener('change',e=>{ if(e.target.value==='card') $('#f-type').value='card'; });
  } else if(kind==='income'){
    $('#modalTitle').textContent='Registrar renda';
    fields.innerHTML=field('description','Descrição','text','required')+field('amount','Valor','text','inputmode="decimal" required')+field('dateExpected','Data prevista','date',`value="${todayISO()}"`)+selectField('status','Status',[['received','Recebida'],['expected','Prevista']])+field('dateReceived','Data recebida','date',`value="${todayISO()}"`);
  } else if(kind==='expense'){
    $('#modalTitle').textContent='Despesa essencial';
    fields.innerHTML=field('description','Descrição','text','required')+field('amount','Valor','text','inputmode="decimal" required')+selectField('category','Categoria',[['food','Alimentação'],['energy','Energia'],['water','Água'],['transport','Transporte'],['medicine','Medicamentos'],['internet','Internet'],['housing','Moradia'],['other','Outro']])+field('dueDate','Vencimento','date')+selectField('status','Status',[['reserved','Reservada'],['paid','Paga']]);
  } else if(kind==='payment'){
    $('#modalTitle').textContent='Registrar pagamento';
    const open=state.debts.map(d=>({...d,balanceCents:debtBalance(d,state.payments)})).filter(d=>d.balanceCents>0);
    fields.innerHTML=selectField('debtId','Dívida',open.map(d=>[d.id,`${d.name} — ${money(d.balanceCents)}`]),'full')+field('amount','Valor pago','text','inputmode="decimal" required')+field('date','Data','date',`required value="${todayISO()}"`)+`<div class="field full"><label for="f-notes">Observação</label><textarea id="f-notes" name="notes"></textarea></div>`;
    if(data.debtId && $('#f-debtId')) $('#f-debtId').value=data.debtId;
  }
  $('#modal').showModal();
}

$('#modalForm').addEventListener('submit',async e=>{
  if(e.submitter?.value==='cancel') return;
  e.preventDefault();
  const fd=new FormData(e.currentTarget), kind=e.currentTarget.dataset.kind, id=e.currentTarget.dataset.id;
  if(kind==='debt'){
    const amount=toCents(fd.get('amount')); if(amount<=0) return toast('Informe um valor maior que zero.');
    const obj={id:id||uid('debt'),name:fd.get('name').trim(),creditor:fd.get('creditor').trim(),category:fd.get('category'),type:fd.get('type'),originalCents:amount,dueDate:fd.get('dueDate')||null,installments:Number(fd.get('installments'))||null,priority:Number(fd.get('priority'))||10,notes:fd.get('notes').trim(),status:'active',updatedAt:new Date().toISOString(),createdAt:dataCreated(id,'debts')};
    await put('debts',obj); toast(id?'Dívida atualizada.':'Dívida cadastrada.');
  }
  if(kind==='income'){
    const obj={id:uid('income'),description:fd.get('description').trim(),amountCents:toCents(fd.get('amount')),dateExpected:fd.get('dateExpected')||null,dateReceived:fd.get('status')==='received'?(fd.get('dateReceived')||todayISO()):null,status:fd.get('status'),createdAt:new Date().toISOString()}; await put('incomes',obj); toast('Renda registrada.');
  }
  if(kind==='expense'){
    const obj={id:uid('expense'),description:fd.get('description').trim(),amountCents:toCents(fd.get('amount')),category:fd.get('category'),dueDate:fd.get('dueDate')||null,status:fd.get('status'),createdAt:new Date().toISOString()}; await put('expenses',obj); toast('Despesa essencial registrada.');
  }
  if(kind==='payment'){
    const debt=state.debts.find(d=>d.id===fd.get('debtId')); const amt=toCents(fd.get('amount'));
    if(!debt||amt<=0) return toast('Escolha uma dívida e informe o valor.');
    const bal=debtBalance(debt,state.payments); if(amt>bal) return toast(`O pagamento é maior que o saldo de ${money(bal)}.`);
    await put('payments',{id:uid('pay'),debtId:debt.id,amountCents:amt,date:fd.get('date')||todayISO(),notes:fd.get('notes').trim(),status:'confirmed',createdAt:new Date().toISOString()}); toast(amt===bal?'Dívida quitada. Esta pendência foi encerrada.':`Pagamento registrado. Saldo restante: ${money(bal-amt)}.`);
  }
  $('#modal').close(); await refresh();
});
function dataCreated(id,store){ return state[store]?.find?.(x=>x.id===id)?.createdAt || new Date().toISOString(); }
async function refresh(){ state.debts=await getAll('debts'); state.payments=await getAll('payments'); state.incomes=await getAll('incomes'); state.expenses=await getAll('expenses'); state.plans=await getAll('plans'); state.settings=await getAll('settings'); render(); }

$$('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
$$('[data-jump]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.jump)));
$('#addDebtBtn').addEventListener('click',()=>openModal('debt'));
$('#addIncomeBtn').addEventListener('click',()=>openModal('income'));
$('#quickIncome').addEventListener('click',()=>openModal('income'));
$('#addExpenseBtn').addEventListener('click',()=>openModal('expense'));
$('#quickPayment').addEventListener('click',()=>openModal('payment'));
$('#priorityPay').addEventListener('click',e=>openModal('payment',{debtId:e.currentTarget.dataset.debtId}));
$('#debtFilters').addEventListener('click',e=>{ const b=e.target.closest('[data-filter]'); if(!b)return; state.debtFilter=b.dataset.filter; $$('#debtFilters .seg').forEach(x=>x.classList.toggle('active',x===b)); renderDebts(); });
$('#debtList').addEventListener('click',e=>{ const pay=e.target.closest('[data-pay]'); if(pay)openModal('payment',{debtId:pay.dataset.pay}); const edit=e.target.closest('[data-edit-debt]'); if(edit)openModal('debt',state.debts.find(d=>d.id===edit.dataset.editDebt)); });
$('#savePlan').addEventListener('click',async()=>{
  const items=$$('.plan-input').map(i=>({debtId:i.dataset.debt,amountCents:toCents(i.value)})).filter(i=>i.amountCents>0);
  const sum=items.reduce((s,i)=>s+i.amountCents,0), t=calc();
  if(sum>t.plannable) return toast('O plano ultrapassa o valor disponível para dívidas após proteger essenciais e reserva. Ajuste os valores.');
  const obj={id:`plan_${monthKey()}`,month:monthKey(),items,status:'confirmed',availableAtPlanningCents:t.available,createdAt:currentPlan()?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()}; await put('plans',obj); toast('Planejamento salvo. Os saldos reais não foram alterados.'); await refresh();
});
$('#exportBackup').addEventListener('click',async()=>{ const payload=await exportAll(); const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`sair-das-dividas-backup-${todayISO()}.json`; a.click(); URL.revokeObjectURL(a.href); toast('Backup exportado.'); });
$('#importBackup').addEventListener('change',async e=>{ const file=e.target.files?.[0]; if(!file)return; try{ const payload=JSON.parse(await file.text()); await importAll(payload); await refresh(); toast('Backup restaurado.'); }catch(err){toast('Não foi possível importar este arquivo.');} e.target.value=''; });
$('#resetDemo').addEventListener('click',async()=>{ if(!confirm('Apagar todos os dados deste navegador? Esta ação não pode ser desfeita sem um backup.'))return; await clearAll(); await load(); toast('Dados locais apagados.'); });

load().catch(err=>{ console.error(err); $('#storageStatus').textContent='Banco local: erro'; toast('Não foi possível abrir o banco local.'); });
