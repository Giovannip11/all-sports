-- All Sports — Eventos, participação, notificações
--
-- Como aplicar:
--   1. Abra o projeto no painel do Supabase (https://supabase.com/dashboard);
--   2. Vá em "SQL Editor" > "New query";
--   3. Cole todo este arquivo e clique em "Run".
--
-- Este script não precisa ser rodado pelo backend: o cliente de serviço (service-role)
-- usado pela API não tem permissão para criar tabelas/funções, só para ler e escrever
-- linhas — por isso essa etapa é manual, uma única vez por ambiente (dev/produção).

-- ---------------------------------------------------------------------------
-- Alguns projetos Supabase já vêm com uma tabela "events" de um template
-- diferente (com sport_id/venue_id, PostGIS, enums de status etc.), que não é
-- o schema que a API deste projeto usa. Se for o seu caso e a tabela estiver
-- vazia, descomente a linha abaixo para substituí-la pela nossa — senão pule.
-- ---------------------------------------------------------------------------
-- drop table if exists public.events cascade;

-- ---------------------------------------------------------------------------
-- events: rachas, encontros e torneios criados por um organizador
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references auth.users(id) on delete cascade,
  organizer_name text not null,
  sport text not null,
  title text not null,
  description text,
  location text not null,
  latitude double precision not null,
  longitude double precision not null,
  starts_at timestamptz not null,
  max_participants int not null check (max_participants > 0),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_sport_idx on public.events (sport);
create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists events_organizer_idx on public.events (organizer_id);

-- ---------------------------------------------------------------------------
-- event_participants: inscrição de um usuário em um evento
-- ---------------------------------------------------------------------------
create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  presence_confirmed boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists event_participants_event_idx on public.event_participants (event_id);
create index if not exists event_participants_user_idx on public.event_participants (user_id);

-- ---------------------------------------------------------------------------
-- notifications: alertas in-app por usuário
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  type text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: habilitado em todas as tabelas, sem policies para anon/authenticated.
-- A API (backend) sempre acessa com a chave service_role, que ignora RLS —
-- é assim que o restante do projeto já funciona (auth, perfil, storage).
-- Isso impede qualquer acesso direto das tabelas a partir do app com a chave
-- anônima, mesmo que ela vaze: só o backend, com a service_role key, consegue
-- ler ou escrever aqui.
-- ---------------------------------------------------------------------------
alter table public.events enable row level security;
alter table public.event_participants enable row level security;
alter table public.notifications enable row level security;

-- ---------------------------------------------------------------------------
-- join_event: inscreve um usuário em um evento de forma segura contra
-- concorrência (RNF09 — "impedir disputa pela última vaga em inscrições
-- simultâneas"). O "select ... for update" trava a linha do evento até o fim
-- da transação, serializando chamadas concorrentes para o mesmo evento.
-- ---------------------------------------------------------------------------
create or replace function public.join_event(p_event_id uuid, p_user_id uuid)
returns public.event_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_status text;
  v_count int;
  v_existing public.event_participants;
  v_row public.event_participants;
begin
  -- Locks the event row until this transaction ends, so two concurrent calls
  -- for the same event run one after the other, never truly in parallel.
  select max_participants, status into v_max, v_status
  from public.events
  where id = p_event_id
  for update;

  if v_max is null then
    raise exception 'event_not_found';
  end if;

  if v_status <> 'active' then
    raise exception 'event_cancelled';
  end if;

  select * into v_existing
  from public.event_participants
  where event_id = p_event_id and user_id = p_user_id;

  if found and v_existing.status = 'confirmed' then
    return v_existing; -- already joined, no-op
  end if;

  select count(*) into v_count
  from public.event_participants
  where event_id = p_event_id and status = 'confirmed';

  if v_count >= v_max then
    raise exception 'event_full';
  end if;

  if found then
    update public.event_participants
    set status = 'confirmed', joined_at = now()
    where event_id = p_event_id and user_id = p_user_id
    returning * into v_row;
  else
    insert into public.event_participants (event_id, user_id, status)
    values (p_event_id, p_user_id, 'confirmed')
    returning * into v_row;
  end if;

  return v_row;
end;
$$;
