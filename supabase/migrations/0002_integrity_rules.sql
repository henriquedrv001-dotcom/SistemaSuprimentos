-- Regras de integridade adicionais para o protótipo.
-- Revisar com o desenvolvedor antes de uso real.

create or replace function public.validate_purchase_order_line()
returns trigger
language plpgsql
as $$
declare
  v_order_type public.order_type;
  v_order_cycle uuid;
  v_item_cycle uuid;
  v_licensed_item_item uuid;
begin
  select order_type, cycle_id
    into v_order_type, v_order_cycle
    from public.purchase_orders
   where id = new.purchase_order_id;

  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  if new.cycle_item_id is not null then
    select item_id, cycle_id
      into v_item_cycle, v_order_cycle
      from public.cycle_items
     where id = new.cycle_item_id;

    if not found then
      raise exception 'Linha de planejamento do ciclo não encontrada.';
    end if;

    if v_item_cycle <> new.item_id then
      raise exception 'O item da linha do pedido deve corresponder ao item planejado no ciclo.';
    end if;
  end if;

  if v_order_type = 'PDF' then
    if new.licensed_item_id is null then
      raise exception 'Para PDF, selecione obrigatoriamente o item licitado/pedido ERP de origem do PDL.';
    end if;

    select item_id into v_licensed_item_item
      from public.licensed_items
     where id = new.licensed_item_id;

    if not found then
      raise exception 'Item licitado de origem não encontrado.';
    end if;

    if v_licensed_item_item <> new.item_id then
      raise exception 'O item do PDF deve corresponder ao item licitado selecionado.';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_validate_purchase_order_line
before insert or update on public.purchase_order_lines
for each row execute function public.validate_purchase_order_line();

-- Views informativas. A validação de saldo/compromissos em concorrência deve
-- ser implementada com operações transacionais no servidor antes de produção.
create or replace view public.receipt_totals_by_order_line as
select
  pol.id as purchase_order_line_id,
  pol.purchase_order_id,
  pol.item_id,
  pol.licensed_item_id,
  pol.requested_quantity,
  coalesce(sum(r.received_quantity), 0)::numeric(14,3) as received_quantity,
  coalesce(sum(r.rejected_quantity), 0)::numeric(14,3) as rejected_quantity,
  greatest(
    pol.requested_quantity - coalesce(sum(r.received_quantity), 0) - coalesce(sum(r.rejected_quantity), 0),
    0
  )::numeric(14,3) as unresolved_quantity
from public.purchase_order_lines pol
left join public.receipts r on r.purchase_order_line_id = pol.id
group by pol.id;

create or replace view public.licensed_item_balance_summary as
select
  li.id as licensed_item_id,
  li.pdl_id,
  li.item_id,
  li.erp_order_number,
  li.supplier_name,
  li.quoted_unit_price,
  li.tendered_quantity,
  coalesce(committed.total_committed, 0)::numeric(14,3) as committed_quantity,
  coalesce(received.total_received, 0)::numeric(14,3) as received_quantity,
  greatest(
    li.tendered_quantity - coalesce(committed.total_committed, 0),
    0
  )::numeric(14,3) as available_before_final_reconciliation
from public.licensed_items li
left join (
  select pol.licensed_item_id, sum(pol.requested_quantity) as total_committed
  from public.purchase_order_lines pol
  join public.purchase_orders po on po.id = pol.purchase_order_id
  where pol.licensed_item_id is not null
    and po.status <> 'Cancelado'
  group by pol.licensed_item_id
) committed on committed.licensed_item_id = li.id
left join (
  select pol.licensed_item_id, sum(r.received_quantity) as total_received
  from public.purchase_order_lines pol
  join public.receipts r on r.purchase_order_line_id = pol.id
  where pol.licensed_item_id is not null
  group by pol.licensed_item_id
) received on received.licensed_item_id = li.id;

-- Nota: a view acima é apenas ponto de partida. Para saldo real, precisamos definir
-- política de compromisso parcial, cancelamento de linhas e como releases afetam o
-- saldo. Não usar como fonte operacional definitiva antes de fechar essas regras.
