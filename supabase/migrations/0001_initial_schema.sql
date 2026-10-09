-- Esquema inicial do Aplicativo de Suprimentos.
-- Aplicar apenas em ambiente de desenvolvimento/teste após revisão.
-- Não representa integração com o ERP corporativo.

create extension if not exists pgcrypto;

create type public.solicitation_criterion as enum ('Mensal', 'Entrada e saída', 'Sob solicitação');
create type public.cycle_status as enum ('Planejamento', 'Em execução', 'Encerrado');
create type public.order_type as enum ('PCD', 'PDF');
create type public.order_status as enum (
  'Aguardando ERP',
  'Aguardando entrega',
  'Recebimento parcial',
  'Concluído',
  'Com ocorrência',
  'Cancelado'
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null,
  unit text not null,
  item_group text not null,
  solicitation_criterion public.solicitation_criterion not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.supply_cycles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  solicitation_start date not null,
  first_delivery date,
  last_delivery date,
  closing_date date,
  status public.cycle_status not null default 'Planejamento',
  notes text,
  created_at timestamptz not null default now(),
  check (first_delivery is null or last_delivery is null or first_delivery <= last_delivery)
);

create table public.cycle_items (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.supply_cycles(id) on delete restrict,
  item_id uuid not null references public.items(id) on delete restrict,
  planned_quantity numeric(14,3) not null check (planned_quantity >= 0),
  created_at timestamptz not null default now(),
  unique (cycle_id, item_id)
);

create table public.pdls (
  id uuid primary key default gen_random_uuid(),
  pdl_code text not null unique,
  description text,
  planning_date date,
  status text not null default 'Planejamento',
  notes text,
  created_at timestamptz not null default now()
);

-- Um item pode existir em vários PDLs e pode ter mais de um processo ativo.
create table public.licensed_items (
  id uuid primary key default gen_random_uuid(),
  pdl_id uuid not null references public.pdls(id) on delete restrict,
  item_id uuid not null references public.items(id) on delete restrict,
  erp_order_number text not null,
  supplier_name text not null,
  quoted_unit_price numeric(14,4) check (quoted_unit_price is null or quoted_unit_price >= 0),
  tendered_quantity numeric(14,3) not null check (tendered_quantity >= 0),
  status text not null default 'Ativo',
  awarded_at date,
  notes text,
  created_at timestamptz not null default now(),
  unique (pdl_id, item_id, erp_order_number)
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  order_type public.order_type not null,
  cycle_id uuid references public.supply_cycles(id) on delete restrict,
  erp_order_number text,
  status public.order_status not null default 'Aguardando ERP',
  requested_at date,
  expected_delivery date,
  created_by_label text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  item_id uuid not null references public.items(id) on delete restrict,
  cycle_item_id uuid references public.cycle_items(id) on delete restrict,
  licensed_item_id uuid references public.licensed_items(id) on delete restrict,
  requested_quantity numeric(14,3) not null check (requested_quantity > 0),
  -- Em produção, compromissos e saldos precisam ser calculados e validados
  -- por transações/rotinas no servidor para evitar concorrência e duplicidade.
  notes text,
  created_at timestamptz not null default now()
);

-- Observação: a regra condicional PCD/PDF (exigir licensed_item_id para PDF)
-- deve ser implementada por trigger/constraint revisada e validada antes de produção.

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  purchase_order_line_id uuid not null references public.purchase_order_lines(id) on delete restrict,
  received_at date not null,
  received_quantity numeric(14,3) not null default 0 check (received_quantity >= 0),
  rejected_quantity numeric(14,3) not null default 0 check (rejected_quantity >= 0),
  occurrence text,
  notes text,
  created_at timestamptz not null default now(),
  check (received_quantity + rejected_quantity > 0)
);

create table public.occurrences (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid references public.purchase_orders(id) on delete restrict,
  purchase_order_line_id uuid references public.purchase_order_lines(id) on delete restrict,
  licensed_item_id uuid references public.licensed_items(id) on delete restrict,
  occurrence_type text not null,
  description text not null,
  justification text,
  status text not null default 'Aberta',
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.status_history (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  old_status text,
  new_status text not null,
  changed_by text,
  reason text,
  created_at timestamptz not null default now()
);

create index idx_cycle_items_cycle on public.cycle_items(cycle_id);
create index idx_cycle_items_item on public.cycle_items(item_id);
create index idx_licensed_items_item on public.licensed_items(item_id);
create index idx_licensed_items_pdl on public.licensed_items(pdl_id);
create index idx_order_lines_order on public.purchase_order_lines(purchase_order_id);
create index idx_order_lines_licensed_item on public.purchase_order_lines(licensed_item_id);
create index idx_receipts_line on public.receipts(purchase_order_line_id);
create index idx_orders_status on public.purchase_orders(status);

-- Para produção: habilitar RLS em todas as tabelas e criar policies por perfil.
-- Não publicar o sistema nem inserir dados corporativos reais antes disso.
