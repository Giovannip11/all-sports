set search_path = public, extensions;

create type public.payment_purpose as enum ('event_registration', 'tournament_fee', 'subscription');
create type public.payment_status  as enum ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');
create type public.payment_method  as enum ('pix', 'credit_card', 'debit_card', 'wallet');

create table public.payments (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references public.profiles(id) on delete set null,
  purpose               public.payment_purpose not null,
  event_registration_id uuid references public.event_registrations(id) on delete set null,
  tournament_team_id    uuid references public.tournament_teams(id) on delete set null,
  plan_id               smallint references public.plans(id) on delete restrict,
  subscription_id       uuid references public.subscriptions(id) on delete set null,
  gateway               text not null check (gateway ~ '^[a-z0-9_]+$'),
  gateway_payment_id    text,
  gateway_customer_id   text,
  idempotency_key       text not null unique,
  amount_cents          int not null check (amount_cents > 0),
  fee_cents             int not null default 0 check (fee_cents >= 0),
  refunded_amount_cents int not null default 0 check (refunded_amount_cents >= 0),
  currency              char(3) not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  method                public.payment_method not null,
  card_brand            text,
  card_last4            char(4) check (card_last4 ~ '^[0-9]{4}$'),
  status                public.payment_status not null default 'pending',
  failure_reason        text,
  paid_at               timestamptz,
  refunded_at           timestamptz,
  expires_at            timestamptz,
  needs_attention       boolean not null default false,
  metadata              jsonb not null default '{}'::jsonb,
  anonymized_at         timestamptz,
  retention_until       timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint payments_fee_chk     check (fee_cents <= amount_cents),
  constraint payments_refund_chk  check (refunded_amount_cents <= amount_cents),
  constraint payments_card_chk    check (method in ('credit_card', 'debit_card') or (card_brand is null and card_last4 is null)),
  constraint payments_paid_at_chk check (status not in ('paid', 'refunded', 'partially_refunded') or paid_at is not null),
  constraint payments_target_chk  check (
       (purpose = 'event_registration' and tournament_team_id is null and subscription_id is null and plan_id is null)
    or (purpose = 'tournament_fee'     and event_registration_id is null and subscription_id is null and plan_id is null)
    or (purpose = 'subscription'       and event_registration_id is null and tournament_team_id is null)),
  constraint payments_no_card_data_chk check (not (metadata ?| array[
    'card_number', 'number', 'pan', 'cvv', 'cvc', 'security_code', 'expiration', 'exp_month', 'exp_year']))
);
create unique index payments_gateway_id_uniq on public.payments (gateway, gateway_payment_id) where gateway_payment_id is not null;
create index payments_user_idx         on public.payments (user_id, created_at desc);
create index payments_status_idx       on public.payments (status, created_at);
create index payments_registration_idx on public.payments (event_registration_id);
create index payments_team_idx         on public.payments (tournament_team_id);
create index payments_subscription_idx on public.payments (subscription_id);
create index payments_plan_idx         on public.payments (plan_id);
create index payments_retention_idx    on public.payments (retention_until) where retention_until is not null;
create index payments_attention_idx    on public.payments (created_at) where needs_attention;

create trigger payments_set_updated_at before update on public.payments
  for each row execute function private.set_updated_at();

create table public.payment_refunds (
  id                uuid primary key default gen_random_uuid(),
  payment_id        uuid not null references public.payments(id) on delete cascade,
  amount_cents      int not null check (amount_cents > 0),
  reason            text,
  gateway_refund_id text,
  created_at        timestamptz not null default now()
);
create index payment_refunds_payment_idx on public.payment_refunds (payment_id);
create unique index payment_refunds_gateway_uniq on public.payment_refunds (payment_id, gateway_refund_id)
  where gateway_refund_id is not null;

create table public.payment_webhook_events (
  id               uuid primary key default gen_random_uuid(),
  gateway          text not null,
  gateway_event_id text not null,
  type             text not null,
  payload          jsonb not null,
  received_at      timestamptz not null default now(),
  processed_at     timestamptz,
  attempts         int not null default 0,
  error            text,
  unique (gateway, gateway_event_id)
);
create index payment_webhook_events_pending_idx on public.payment_webhook_events (received_at) where processed_at is null;

alter table public.payments enable row level security;
create policy payments_select on public.payments for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.event_registrations r
              where r.id = event_registration_id and public.is_event_organizer(r.event_id))
  or exists (select 1 from public.tournament_teams t
              where t.id = tournament_team_id and public.is_event_organizer(t.tournament_id)));

alter table public.payment_refunds enable row level security;
create policy payment_refunds_select on public.payment_refunds for select to authenticated
  using (exists (select 1 from public.payments p where p.id = payment_id));

alter table public.payment_webhook_events enable row level security;

create function private.payments_before_write() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_price    int;
  v_user     uuid;
  v_status   text;
  v_approved timestamptz;
begin
  if tg_op = 'INSERT' then
    if new.user_id is null then raise exception 'payment_user_required' using errcode = 'P0001'; end if;

    if new.purpose = 'event_registration' then
      select r.user_id, e.price_cents, r.status::text into v_user, v_price, v_status
        from public.event_registrations r join public.events e on e.id = r.event_id
       where r.id = new.event_registration_id;
      if not found then raise exception 'payment_target_missing' using errcode = 'P0001'; end if;
      if v_status <> 'confirmed' then raise exception 'registration_not_payable' using errcode = 'P0001'; end if;

    elsif new.purpose = 'tournament_fee' then
      select t.captain_id, tn.entry_fee_cents, t.status::text, t.approved_at into v_user, v_price, v_status, v_approved
        from public.tournament_teams t join public.tournaments tn on tn.event_id = t.tournament_id
       where t.id = new.tournament_team_id;
      if not found then raise exception 'payment_target_missing' using errcode = 'P0001'; end if;
      if v_status <> 'pending' or v_approved is null then raise exception 'team_not_payable' using errcode = 'P0001'; end if;

    else
      select pl.price_cents into v_price from public.plans pl where pl.id = new.plan_id and pl.is_active;
      if not found then raise exception 'payment_target_missing' using errcode = 'P0001'; end if;
      v_user := new.user_id;
    end if;

    if new.user_id <> v_user then raise exception 'payment_user_mismatch' using errcode = 'P0001'; end if;
    if new.amount_cents <> v_price then
      raise exception 'payment_amount_mismatch' using errcode = 'P0001', detail = 'expected=' || v_price;
    end if;
  end if;

  if new.status in ('paid', 'refunded', 'partially_refunded') and new.paid_at is null then new.paid_at := now(); end if;
  if new.status = 'refunded' and new.refunded_at is null then new.refunded_at := now(); end if;

  if tg_op = 'UPDATE' and new.status = 'paid' and old.status <> 'paid' then
    if new.purpose = 'event_registration' and not exists (
         select 1 from public.event_registrations where id = new.event_registration_id and status = 'confirmed') then
      new.needs_attention := true;
    elsif new.purpose = 'tournament_fee' and not exists (
         select 1 from public.tournament_teams where id = new.tournament_team_id and status in ('pending', 'confirmed')) then
      new.needs_attention := true;
    end if;
  end if;
  return new;
end $$;
create trigger payments_before_write before insert or update on public.payments
  for each row execute function private.payments_before_write();

create function private.payments_after_update() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.status = 'paid' and old.status <> 'paid' then
    if new.purpose = 'event_registration' and new.event_registration_id is not null then
      update public.event_registrations set hold_expires_at = null
       where id = new.event_registration_id and status = 'confirmed';
    elsif new.purpose = 'tournament_fee' and new.tournament_team_id is not null then
      update public.tournament_teams set fee_paid_at = now()
       where id = new.tournament_team_id and status in ('pending', 'confirmed');
    end if;
    perform private.notify(new.user_id, 'payment_paid', 'Pagamento confirmado',
      'Recebemos seu pagamento de R$ ' || to_char(new.amount_cents / 100.0, 'FM999G990D00') || '.',
      null, jsonb_build_object('payment_id', new.id, 'purpose', new.purpose));
  elsif new.status = 'failed' and old.status <> 'failed' then
    perform private.notify(new.user_id, 'payment_failed', 'Pagamento não aprovado',
      'Não conseguimos processar seu pagamento. Tente novamente.',
      null, jsonb_build_object('payment_id', new.id, 'purpose', new.purpose));
  end if;
  return null;
end $$;
create trigger payments_after_update after update of status on public.payments
  for each row execute function private.payments_after_update();

create function private.refunds_before_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  p public.payments;
begin
  select * into p from public.payments where id = new.payment_id for update;
  if p.status not in ('paid', 'partially_refunded') then
    raise exception 'payment_not_refundable' using errcode = 'P0001';
  end if;
  if new.amount_cents > p.amount_cents - p.refunded_amount_cents then
    raise exception 'refund_exceeds_payment' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger payment_refunds_before_insert before insert on public.payment_refunds
  for each row execute function private.refunds_before_insert();

create function private.refunds_after_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.payments
     set refunded_amount_cents = refunded_amount_cents + new.amount_cents,
         status = case when refunded_amount_cents + new.amount_cents = amount_cents then 'refunded'::public.payment_status
                       else 'partially_refunded'::public.payment_status end,
         refunded_at = now()
   where id = new.payment_id;
  return null;
end $$;
create trigger payment_refunds_after_insert after insert on public.payment_refunds
  for each row execute function private.refunds_after_insert();
