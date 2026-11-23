set search_path = public, extensions;

create type public.billing_period      as enum ('free', 'monthly', 'yearly');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'expired');

create table public.plans (
  id                         smallint primary key,
  code                       text not null unique check (code ~ '^[a-z_]+$'),
  name                       text not null,
  description                text,
  tier                       smallint not null unique check (tier between 0 and 9),
  price_cents                int not null check (price_cents >= 0),
  billing_period             public.billing_period not null,

  max_events_per_week        int check (max_events_per_week >= 0),
  max_participants_per_event int check (max_participants_per_event >= 0),
  max_active_tournaments     int check (max_active_tournaments >= 0),
  max_teams_per_tournament   int check (max_teams_per_tournament >= 0),
  is_active                  boolean not null default true,
  sort_order                 smallint not null default 0,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint plans_free_price_chk check ((billing_period = 'free') = (price_cents = 0))
);

insert into public.plans
  (id, code, name, description, tier, price_cents, billing_period,
   max_events_per_week, max_participants_per_event, max_active_tournaments, max_teams_per_tournament, sort_order)
values
  (1, 'free',         'Gratuito',      'Visualiza rachas e eventos públicos no mapa, participa e interage via chat.',
      0,    0, 'free',    0,    0,    0,    0, 1),
  (2, 'casual',       'Casual',        'Cria rachas: até 2 por semana, com até 20 participantes.',
      1, 1990, 'monthly', 2,   20,    0,    0, 2),
  (3, 'intermediate', 'Intermediário', 'Gestão de inscrição, divulgação e cobrança de taxa de campeonatos amadores.',
      2, 4990, 'monthly', 10, 100,    3,   32, 3),
  (4, 'arena',        'Arena',         'Múltiplas quadras/áreas privadas, torneios de grande volume e suporte dedicado.',
      3, 14990, 'monthly', null, null, null, null, 4);

create trigger plans_set_updated_at before update on public.plans
  for each row execute function private.set_updated_at();

alter table public.plans enable row level security;
create policy plans_read on public.plans for select to anon, authenticated using (is_active);

create table public.permissions (
  code        text primary key check (code ~ '^[a-z_]+$'),
  description text not null,
  min_tier    smallint not null references public.plans(tier) on update cascade
);

insert into public.permissions (code, description, min_tier) values
  ('view_public_events',   'Ver rachas e eventos públicos no mapa e na lista',                 0),
  ('join_events',          'Inscrever-se em eventos e torneios',                               0),
  ('chat',                 'Conversar (por evento, direto e em grupo)',                        0),
  ('social',               'Seguir pessoas, avaliar e convidar',                               0),
  ('create_event',         'Criar e gerenciar rachas/encontros (respeitando os limites)',      1),
  ('manage_attendance',    'Gerenciar a lista de presença do evento',                          1),
  ('private_events',       'Criar eventos privados (só convidados)',                           1),
  ('recurring_events',     'Criar eventos recorrentes (série)',                                1),
  ('team_draw',            'Sortear times (aleatório ou balanceado por nível)',                1),
  ('paid_events',          'Cobrar taxa de inscrição nos eventos',                             2),
  ('create_tournament',    'Criar e gerenciar torneios/campeonatos',                           2),
  ('promote_events',       'Divulgar/destacar eventos e torneios',                             2),
  ('manage_venues',        'Cadastrar arenas com múltiplas quadras e horários',                3),
  ('high_volume_tournaments', 'Torneios de grande volume',                                     3),
  ('priority_support',     'Suporte dedicado',                                                 3);

alter table public.permissions enable row level security;
create policy permissions_read on public.permissions for select to anon, authenticated using (true);

create view public.plan_permissions with (security_invoker = true) as
select pl.code as plan_code, pm.code as permission_code
from public.plans pl
join public.permissions pm on pm.min_tier <= pl.tier;

create table public.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.profiles(id) on delete cascade,
  plan_id                 smallint not null references public.plans(id) on delete restrict,
  status                  public.subscription_status not null default 'active',
  started_at              timestamptz not null default now(),
  current_period_start    timestamptz not null default now(),
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  canceled_at             timestamptz,
  ended_at                timestamptz,
  gateway                 text,
  gateway_subscription_id text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint subscriptions_period_chk check (current_period_end is null or current_period_end > current_period_start),
  constraint subscriptions_ended_chk  check (status not in ('canceled', 'expired') or ended_at is not null)
);

create unique index subscriptions_one_current_per_user
  on public.subscriptions (user_id) where status in ('trialing', 'active', 'past_due');
create index subscriptions_user_idx    on public.subscriptions (user_id, created_at desc);
create index subscriptions_plan_idx    on public.subscriptions (plan_id);
create index subscriptions_expiring_idx on public.subscriptions (current_period_end)
  where status in ('trialing', 'active', 'past_due');
create unique index subscriptions_gateway_uniq
  on public.subscriptions (gateway, gateway_subscription_id) where gateway_subscription_id is not null;

create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function private.set_updated_at();

alter table public.subscriptions enable row level security;
create policy subscriptions_select_own on public.subscriptions for select to authenticated using (user_id = auth.uid());

create function private.create_free_subscription() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.subscriptions (user_id, plan_id)
  select new.id, id from public.plans where code = 'free';
  return new;
end $$;

create trigger profiles_create_free_subscription after insert on public.profiles
  for each row execute function private.create_free_subscription();

create function private.user_plan(p_user uuid) returns public.plans
language sql stable security definer set search_path = public, pg_temp
as $$
  select pl.* from public.plans pl
  where pl.id = coalesce(
    (select s.plan_id from public.subscriptions s
      where s.user_id = p_user
        and s.status in ('trialing', 'active', 'past_due')
        and (s.current_period_end is null or s.current_period_end > now())
      order by s.started_at desc limit 1),
    (select id from public.plans where code = 'free'))
$$;

create function private.has_permission(p_user uuid, p_code text) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.permissions pm
    where pm.code = p_code and pm.min_tier <= (private.user_plan(p_user)).tier)
$$;

create function public.my_plan() returns public.plans
language sql stable security definer set search_path = public, pg_temp
as $$ select * from private.user_plan(auth.uid()) $$;

create function public.i_have_permission(p_code text) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select private.has_permission(auth.uid(), p_code) $$;

create function public.my_permissions() returns setof text
language sql stable security definer set search_path = public, pg_temp
as $$
  select pm.code from public.permissions pm
  where pm.min_tier <= (private.user_plan(auth.uid())).tier
  order by pm.min_tier, pm.code
$$;

create view public.current_subscriptions with (security_invoker = true) as
select
  p.id                         as user_id,
  pl.id                        as plan_id,
  pl.code                      as plan_code,
  pl.name                      as plan_name,
  pl.price_cents,
  pl.billing_period,
  pl.max_events_per_week,
  pl.max_participants_per_event,
  pl.max_active_tournaments,
  pl.max_teams_per_tournament,
  s.id                         as subscription_id,
  s.status,
  s.current_period_start,
  s.current_period_end,
  s.cancel_at_period_end
from public.profiles p
cross join lateral public.my_plan() pl
left join lateral (
  select * from public.subscriptions s
  where s.user_id = p.id and s.status in ('trialing', 'active', 'past_due')
  order by s.started_at desc limit 1) s on s.plan_id = pl.id
where p.id = auth.uid();

create function public.switch_plan(
  p_user_id uuid,
  p_plan_code text,
  p_period_end timestamptz default null,
  p_gateway text default null,
  p_gateway_subscription_id text default null
) returns public.subscriptions
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_plan public.plans;
  v_row  public.subscriptions;
begin
  select * into v_plan from public.plans where code = p_plan_code and is_active;
  if not found then raise exception 'plan_not_found' using errcode = 'P0002'; end if;

  update public.subscriptions
     set status = 'canceled', canceled_at = now(), ended_at = now(), cancel_at_period_end = false
   where user_id = p_user_id and status in ('trialing', 'active', 'past_due');

  insert into public.subscriptions
    (user_id, plan_id, status, current_period_end, gateway, gateway_subscription_id)
  values
    (p_user_id, v_plan.id, 'active',
     case when v_plan.billing_period = 'free' then null else p_period_end end,
     p_gateway, p_gateway_subscription_id)
  returning * into v_row;

  perform private.notify(p_user_id, 'subscription_changed',
    'Plano atualizado', 'Seu plano agora é ' || v_plan.name || '.', null,
    jsonb_build_object('plan_code', v_plan.code));
  return v_row;
end $$;

create function public.cancel_my_subscription() returns public.subscriptions
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_row public.subscriptions;
begin
  update public.subscriptions s
     set cancel_at_period_end = true
   where s.user_id = auth.uid()
     and s.status in ('trialing', 'active', 'past_due')
     and s.plan_id <> (select id from public.plans where code = 'free')
  returning * into v_row;
  if not found then raise exception 'no_paid_subscription' using errcode = 'P0002'; end if;
  return v_row;
end $$;

do $$
declare r record;
begin
  for r in
    select a.code as lower_plan, b.code as higher_plan, c.col
    from public.plans a
    join public.plans b on b.tier > a.tier
    cross join lateral (values
      ('max_events_per_week',        a.max_events_per_week,        b.max_events_per_week),
      ('max_participants_per_event', a.max_participants_per_event, b.max_participants_per_event),
      ('max_active_tournaments',     a.max_active_tournaments,     b.max_active_tournaments),
      ('max_teams_per_tournament',   a.max_teams_per_tournament,   b.max_teams_per_tournament)
    ) as c(col, lo, hi)
    where c.hi is not null and (c.lo is null or c.lo > c.hi)
  loop
    raise exception 'Planos não cumulativos: % tem limite %, maior que % (%).',
      r.lower_plan, r.col, r.higher_plan, r.col;
  end loop;
end $$;
