-- PostgreSQL / Supabase schema for Sair das Dívidas
-- Values are stored in integer cents to avoid floating-point errors.
create extension if not exists pgcrypto;

create type public.debt_type as enum ('single','installment','flexible','card');
create type public.debt_status as enum ('active','negotiating','overdue','paused','paid','archived');
create type public.payment_status as enum ('planned','confirmed','partial','rescheduled','not_paid','cancelled');
create type public.income_status as enum ('expected','received','late','cancelled');
create type public.expense_status as enum ('reserved','paid','cancelled');
create type public.plan_status as enum ('draft','confirmed','in_progress','adjusted','completed','archived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  currency text not null default 'BRL',
  reserve_cents bigint not null default 0 check (reserve_cents >= 0),
  default_strategy text not null default 'card_first',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.creditors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  creditor_id uuid references public.creditors(id) on delete set null,
  name text not null,
  category text not null default 'other',
  type public.debt_type not null,
  original_cents bigint not null check (original_cents > 0),
  due_date date,
  installments_count integer check (installments_count is null or installments_count > 0),
  priority integer not null default 10 check (priority between 1 and 99),
  interest_bps integer not null default 0 check (interest_bps >= 0),
  status public.debt_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index debts_user_status_idx on public.debts(user_id,status);
create index debts_user_due_idx on public.debts(user_id,due_date);

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  number integer not null check (number > 0),
  amount_cents bigint not null check (amount_cents > 0),
  due_date date,
  status public.payment_status not null default 'planned',
  created_at timestamptz not null default now(),
  unique(debt_id,number)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  installment_id uuid references public.installments(id) on delete set null,
  amount_cents bigint not null check (amount_cents > 0),
  payment_date date not null default current_date,
  status public.payment_status not null default 'confirmed',
  method text,
  notes text,
  receipt_path text,
  created_at timestamptz not null default now()
);
create index payments_user_date_idx on public.payments(user_id,payment_date desc);
create index payments_debt_idx on public.payments(debt_id);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  issuer text,
  last_four text check (last_four is null or last_four ~ '^[0-9]{4}$'),
  limit_cents bigint check (limit_cents is null or limit_cents >= 0),
  closing_day integer check (closing_day between 1 and 31),
  due_day integer check (due_day between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.card_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  debt_id uuid references public.debts(id) on delete set null,
  competence text not null check (competence ~ '^[0-9]{4}-[0-9]{2}$'),
  amount_cents bigint not null check (amount_cents >= 0),
  minimum_cents bigint not null default 0 check (minimum_cents >= 0),
  paid_cents bigint not null default 0 check (paid_cents >= 0),
  closing_date date,
  due_date date,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  unique(card_id,competence)
);

create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  category text not null default 'other',
  amount_cents bigint not null check (amount_cents > 0),
  expected_date date,
  received_date date,
  recurring boolean not null default false,
  recurrence text,
  status public.income_status not null default 'expected',
  notes text,
  created_at timestamptz not null default now()
);
create index incomes_user_date_idx on public.incomes(user_id,coalesce(received_date,expected_date));

create table public.essential_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  category text not null default 'other',
  amount_cents bigint not null check (amount_cents > 0),
  due_date date,
  recurring boolean not null default false,
  recurrence text,
  status public.expense_status not null default 'reserved',
  created_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_month text not null check (period_month ~ '^[0-9]{4}-[0-9]{2}$'),
  available_snapshot_cents bigint not null default 0,
  reserve_snapshot_cents bigint not null default 0,
  status public.plan_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,period_month)
);

create table public.plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete cascade,
  debt_id uuid references public.debts(id) on delete cascade,
  invoice_id uuid references public.card_invoices(id) on delete cascade,
  planned_cents bigint not null check (planned_cents > 0),
  planned_date date,
  status public.payment_status not null default 'planned',
  created_at timestamptz not null default now(),
  check ((debt_id is not null)::int + (invoice_id is not null)::int = 1)
);

create table public.negotiations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  previous_cents bigint,
  new_total_cents bigint,
  terms text,
  negotiated_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid references public.debts(id) on delete cascade,
  kind text not null,
  remind_at timestamptz not null,
  repeat_rule text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

-- Current balances are derived from confirmed payments, never manually trusted.
create or replace view public.debt_balances as
select d.*,
  greatest(0, d.original_cents - coalesce(sum(p.amount_cents) filter (where p.status = 'confirmed'),0))::bigint as balance_cents,
  coalesce(sum(p.amount_cents) filter (where p.status = 'confirmed'),0)::bigint as paid_cents
from public.debts d
left join public.payments p on p.debt_id=d.id
group by d.id;

-- RLS: every row belongs to auth.uid().
alter table public.profiles enable row level security;
alter table public.creditors enable row level security;
alter table public.debts enable row level security;
alter table public.installments enable row level security;
alter table public.payments enable row level security;
alter table public.cards enable row level security;
alter table public.card_invoices enable row level security;
alter table public.incomes enable row level security;
alter table public.essential_expenses enable row level security;
alter table public.plans enable row level security;
alter table public.plan_items enable row level security;
alter table public.negotiations enable row level security;
alter table public.reminders enable row level security;
alter table public.audit_log enable row level security;

create policy profile_owner on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

create policy creditors_owner on public.creditors for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy debts_owner on public.debts for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy installments_owner on public.installments for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy payments_owner on public.payments for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy cards_owner on public.cards for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy invoices_owner on public.card_invoices for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy incomes_owner on public.incomes for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy expenses_owner on public.essential_expenses for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy plans_owner on public.plans for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy plan_items_owner on public.plan_items for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy negotiations_owner on public.negotiations for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy reminders_owner on public.reminders for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy audit_owner on public.audit_log for select using (user_id=auth.uid());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1)));
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
