set search_path = public, extensions;

create extension if not exists pg_trgm    with schema extensions;
create extension if not exists unaccent   with schema extensions;
create extension if not exists btree_gist with schema extensions;

create function private.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create function public.immutable_unaccent(text) returns text
language sql immutable parallel safe strict
set search_path = extensions, public
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

create function public.distance_meters(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
) returns double precision
language sql immutable parallel safe
as $$
  select 2 * 6371000 * asin(sqrt(least(1,
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2))))
$$;

create function private.random_code(p_len int default 8) returns text
language sql volatile
as $$ select substr(replace(gen_random_uuid()::text, '-', ''), 1, p_len) $$;

create table public.app_settings (
  key         text primary key check (key ~ '^[a-z0-9_]+$'),
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);
alter table public.app_settings enable row level security;
create policy app_settings_read on public.app_settings for select to authenticated using (true);
create trigger app_settings_set_updated_at before update on public.app_settings
  for each row execute function private.set_updated_at();

insert into public.app_settings (key, value, description) values
  ('min_signup_age',        '16',                     'Idade mínima (anos) para entrar em eventos.'),
  ('data_retention_months', '24',                     'Meses que pagamentos e auditoria ficam retidos (anonimizados) após a exclusão da conta.'),
  ('timezone',              '"America/Sao_Paulo"',    'Fuso usado para "semana" (limites de plano) e horários de funcionamento.'),
  ('payment_hold_minutes',  '15',                     'Minutos que uma vaga fica reservada aguardando o pagamento.'),
  ('invite_valid_days',     '7',                      'Validade (dias) de um convite direto para evento.'),
  ('max_group_members',     '50',                     'Máximo de pessoas em uma conversa em grupo.'),
  ('review_window_days',    '14',                     'Dias após o fim do evento em que ainda dá para avaliar.');

create function private.setting_int(p_key text, p_default int) returns int
language sql stable
as $$ select coalesce((select (value #>> '{}')::int from public.app_settings where key = p_key), p_default) $$;

create function private.setting_text(p_key text, p_default text) returns text
language sql stable
as $$ select coalesce((select value #>> '{}' from public.app_settings where key = p_key), p_default) $$;

create table public.sports (
  id         smallint generated always as identity primary key,
  slug       text not null unique check (slug ~ '^[a-z0-9_]+$'),
  name       text not null,
  color      text check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_active  boolean not null default true
);
alter table public.sports enable row level security;
create policy sports_read on public.sports for select to anon, authenticated using (true);

insert into public.sports (slug, name, color) values
  ('futebol',       'Futebol',       '#16a34a'),
  ('basquete',      'Basquete',      '#dc2626'),
  ('volei',         'Vôlei',         '#ca8a04'),
  ('poliesportiva', 'Poliesportiva', '#7c3aed'),
  ('corrida',       'Corrida',       '#0d9488'),
  ('ciclismo',      'Bike',          '#2563eb'),
  ('natacao',       'Natação',       '#0891b2');

create type public.gender             as enum ('male', 'female', 'other', 'prefer_not_to_say');
create type public.profile_visibility as enum ('public', 'private');
create type public.skill_level        as enum ('beginner', 'intermediate', 'advanced');
create type public.consent_kind       as enum ('terms_of_use', 'privacy_policy', 'location');
create type public.platform_role      as enum ('admin', 'support');

create function public.skill_rank(p_level public.skill_level) returns int
language sql immutable parallel safe
as $$ select case p_level when 'beginner' then 1 when 'intermediate' then 2 when 'advanced' then 3 end $$;

create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  name               text not null check (char_length(btrim(name)) between 2 and 120),
  phone              text check (phone ~ '^\+?[0-9 ()-]{8,20}$'),
  bio                text check (char_length(bio) <= 280),
  avatar_url         text,
  birth_date         date,
  gender             public.gender,
  country            text not null default 'Brasil' check (char_length(country) >= 2),
  profile_visibility public.profile_visibility not null default 'public',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index profiles_name_trgm_idx
  on public.profiles using gin (public.immutable_unaccent(lower(name)) extensions.gin_trgm_ops);

alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

create function private.enforce_profile_rules() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_min int := private.setting_int('min_signup_age', 16);
begin
  if new.birth_date is not null then
    if new.birth_date > current_date - make_interval(years => v_min) then
      raise exception 'under_min_age' using errcode = 'P0001', detail = 'min_age=' || v_min;
    end if;
    if new.birth_date < current_date - make_interval(years => 120) then
      raise exception 'invalid_birth_date' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_enforce_rules before insert or update on public.profiles
  for each row execute function private.enforce_profile_rules();

create function private.profile_ready_for_events(p_user uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.profiles where id = p_user and birth_date is not null and gender is not null)
$$;

create table public.user_sports (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  sport_id    smallint not null references public.sports(id) on delete restrict,
  skill_level public.skill_level not null default 'beginner',
  position    smallint not null default 1 check (position >= 1),
  created_at  timestamptz not null default now(),
  primary key (user_id, sport_id),
  unique (user_id, position) deferrable initially deferred
);
alter table public.user_sports enable row level security;
create policy user_sports_own on public.user_sports for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.user_consents (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  kind             public.consent_kind not null,
  document_version text not null default 'v1',
  granted          boolean not null,
  recorded_at      timestamptz not null default now(),
  ip               inet,
  user_agent       text
);
create index user_consents_user_idx on public.user_consents (user_id, kind, recorded_at desc);

alter table public.user_consents enable row level security;
create policy user_consents_select_own on public.user_consents for select to authenticated using (user_id = auth.uid());
create policy user_consents_insert_own on public.user_consents for insert to authenticated with check (user_id = auth.uid());

create view public.current_consents with (security_invoker = true) as
select distinct on (user_id, kind) user_id, kind, document_version, granted, recorded_at
from public.user_consents
order by user_id, kind, recorded_at desc;

create table public.platform_admins (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  role       public.platform_role not null default 'support',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);
alter table public.platform_admins enable row level security;

create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.platform_admins where user_id = auth.uid()) $$;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  m          jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name     text;
  v_phone    text;
  v_birth    date;
  v_gender   public.gender;
  v_ts       timestamptz;
  v_version  text := coalesce(nullif(m->>'terms_version', ''), 'v1');
begin
  v_name := coalesce(
    nullif(btrim(m->>'name'), ''),
    nullif(btrim(m->>'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Usuário');
  if char_length(btrim(v_name)) < 2 then v_name := 'Usuário'; end if;
  v_name := left(v_name, 120);

  v_phone := nullif(btrim(m->>'phone'), '');
  if v_phone !~ '^\+?[0-9 ()-]{8,20}$' then v_phone := null; end if;

  begin v_birth := nullif(m->>'birth_date', '')::date;
  exception when others then v_birth := null; end;

  v_gender := (case lower(coalesce(m->>'gender', ''))
    when 'male'              then 'male'
    when 'masculino'         then 'male'
    when 'female'            then 'female'
    when 'feminino'          then 'female'
    when 'other'             then 'other'
    when 'outro'             then 'other'
    when 'prefer_not_to_say' then 'prefer_not_to_say'
    when 'prefiro_nao_informar' then 'prefer_not_to_say'
    else null end)::public.gender;

  insert into public.profiles (id, name, phone, birth_date, gender, country, avatar_url)
  values (
    new.id, v_name, v_phone, v_birth, v_gender,
    coalesce(nullif(btrim(m->>'country'), ''), 'Brasil'),
    coalesce(nullif(m->>'avatar_url', ''), nullif(m->>'picture', '')));

  if m ? 'terms_accepted_at' then
    begin v_ts := (m->>'terms_accepted_at')::timestamptz;
    exception when others then v_ts := now(); end;
    insert into public.user_consents (user_id, kind, document_version, granted, recorded_at)
    values (new.id, 'terms_of_use',   v_version, true, coalesce(v_ts, now())),
           (new.id, 'privacy_policy', v_version, true, coalesce(v_ts, now()));
  end if;

  if lower(coalesce(m->>'location_consent', 'false')) = 'true' then
    insert into public.user_consents (user_id, kind, document_version, granted)
    values (new.id, 'location', v_version, true);
  end if;

  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
