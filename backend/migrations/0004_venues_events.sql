set search_path = public, extensions;

create type public.event_kind        as enum ('pickup', 'meetup', 'tournament');
create type public.event_visibility  as enum ('public', 'private');
create type public.event_status      as enum ('draft', 'open', 'full', 'in_progress', 'finished', 'canceled');
create type public.registration_status as enum ('confirmed', 'waitlisted', 'canceled');
create type public.attendance_status as enum ('unknown', 'present', 'absent');
create type public.invite_status     as enum ('pending', 'accepted', 'declined', 'revoked', 'expired');
create type public.join_request_status as enum ('pending', 'approved', 'rejected', 'canceled');
create type public.recurrence_frequency as enum ('daily', 'weekly', 'monthly');
create type public.draw_mode         as enum ('random', 'balanced');
create type public.review_kind       as enum ('organizer', 'participant');

create table public.venues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) >= 2),
  description text check (char_length(description) <= 2000),
  address     text,
  city        text,
  state       text check (state ~ '^[A-Z]{2}$'),
  country     text not null default 'Brasil',
  latitude    double precision not null check (latitude between -90 and 90),
  longitude   double precision not null check (longitude between -180 and 180),
  phone       text,
  amenities   text[] not null default '{}',
  is_public   boolean not null default true,
  is_active   boolean not null default true,
  owner_id    uuid references public.profiles(id) on delete set null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index venues_geo_idx        on public.venues (latitude, longitude);
create index venues_owner_idx      on public.venues (owner_id);
create index venues_created_by_idx on public.venues (created_by);
create index venues_name_trgm_idx  on public.venues using gin (public.immutable_unaccent(lower(name)) extensions.gin_trgm_ops);
create trigger venues_set_updated_at before update on public.venues
  for each row execute function private.set_updated_at();

create table public.courts (
  id                uuid primary key default gen_random_uuid(),
  venue_id          uuid not null references public.venues(id) on delete cascade,
  name              text not null check (char_length(btrim(name)) >= 1),
  surface           text,
  indoor            boolean not null default false,
  capacity          int check (capacity > 0),
  hourly_price_cents int not null default 0 check (hourly_price_cents >= 0),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (venue_id, name)
);
create trigger courts_set_updated_at before update on public.courts
  for each row execute function private.set_updated_at();

create table public.court_sports (
  court_id uuid not null references public.courts(id) on delete cascade,
  sport_id smallint not null references public.sports(id) on delete restrict,
  primary key (court_id, sport_id)
);

create table public.venue_opening_hours (
  id        uuid primary key default gen_random_uuid(),
  venue_id  uuid not null references public.venues(id) on delete cascade,
  weekday   smallint not null check (weekday between 0 and 6),
  opens_at  time not null,
  closes_at time not null,
  check (closes_at > opens_at),
  unique (venue_id, weekday, opens_at)
);

create function public.can_manage_venue(p_venue uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.venues v
    where v.id = p_venue
      and (v.owner_id = auth.uid() or (v.owner_id is null and v.created_by = auth.uid())))
$$;

create function public.can_manage_court(p_court uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.courts c where c.id = p_court and public.can_manage_venue(c.venue_id))
$$;

alter table public.venues enable row level security;
create policy venues_select on public.venues for select to authenticated
  using (is_public or owner_id = auth.uid() or created_by = auth.uid());
create policy venues_insert on public.venues for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.i_have_permission('create_event')
    and (owner_id is null or (owner_id = auth.uid() and public.i_have_permission('manage_venues'))));
create policy venues_update on public.venues for update to authenticated
  using (owner_id = auth.uid() or (owner_id is null and created_by = auth.uid()))
  with check (owner_id = auth.uid() or (owner_id is null and created_by = auth.uid()));
create policy venues_delete on public.venues for delete to authenticated
  using (owner_id = auth.uid() or (owner_id is null and created_by = auth.uid()));

alter table public.courts enable row level security;
create policy courts_select on public.courts for select to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id));
create policy courts_write on public.courts for all to authenticated
  using (public.can_manage_venue(venue_id) and public.i_have_permission('manage_venues'))
  with check (public.can_manage_venue(venue_id) and public.i_have_permission('manage_venues'));

alter table public.court_sports enable row level security;
create policy court_sports_select on public.court_sports for select to authenticated
  using (exists (select 1 from public.courts c where c.id = court_id));
create policy court_sports_write on public.court_sports for all to authenticated
  using (public.can_manage_court(court_id) and public.i_have_permission('manage_venues'))
  with check (public.can_manage_court(court_id) and public.i_have_permission('manage_venues'));

alter table public.venue_opening_hours enable row level security;
create policy venue_hours_select on public.venue_opening_hours for select to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id));
create policy venue_hours_write on public.venue_opening_hours for all to authenticated
  using (public.can_manage_venue(venue_id) and public.i_have_permission('manage_venues'))
  with check (public.can_manage_venue(venue_id) and public.i_have_permission('manage_venues'));

create table public.event_series (
  id             uuid primary key default gen_random_uuid(),
  organizer_id   uuid references public.profiles(id) on delete set null,
  frequency      public.recurrence_frequency not null,
  interval_count smallint not null default 1 check (interval_count between 1 and 52),
  weekdays       smallint[] check (weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  until_date     date,
  created_at     timestamptz not null default now()
);
alter table public.event_series enable row level security;
create policy event_series_own on public.event_series for all to authenticated
  using (organizer_id = auth.uid()) with check (organizer_id = auth.uid());

create table public.events (
  id                    uuid primary key default gen_random_uuid(),
  organizer_id          uuid references public.profiles(id) on delete set null,
  sport_id              smallint not null references public.sports(id) on delete restrict,
  series_id             uuid references public.event_series(id) on delete set null,
  series_position       smallint check (series_position >= 1),
  venue_id              uuid references public.venues(id) on delete set null,
  court_id              uuid references public.courts(id) on delete set null,
  title                 text not null check (char_length(btrim(title)) between 3 and 120),
  description           text check (char_length(description) <= 2000),
  kind                  public.event_kind not null default 'pickup',
  visibility            public.event_visibility not null default 'public',
  status                public.event_status not null default 'draft',
  skill_level           public.skill_level,
  starts_at             timestamptz not null,
  ends_at               timestamptz not null,
  registration_deadline timestamptz,
  location_name         text not null check (char_length(btrim(location_name)) >= 2),
  address               text,
  city                  text,
  state                 text check (state ~ '^[A-Z]{2}$'),
  latitude              double precision not null check (latitude between -90 and 90),
  longitude             double precision not null check (longitude between -180 and 180),
  max_participants      int check (max_participants between 2 and 5000),
  min_participants      int check (min_participants >= 1),
  waitlist_enabled      boolean not null default true,
  requires_approval     boolean not null default false,
  price_cents           int not null default 0 check (price_cents >= 0),
  currency              char(3) not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  rules                 text check (char_length(rules) <= 2000),
  invite_code           text unique check (invite_code ~ '^[A-Za-z0-9]{6,16}$'),
  promoted_until        timestamptz,
  confirmed_count       int not null default 0 check (confirmed_count >= 0),
  waitlist_count        int not null default 0 check (waitlist_count >= 0),
  canceled_at           timestamptz,
  cancel_reason         text check (char_length(cancel_reason) <= 500),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint events_dates_chk      check (ends_at > starts_at),
  constraint events_deadline_chk   check (registration_deadline is null or registration_deadline <= starts_at),
  constraint events_min_max_chk    check (min_participants is null or max_participants is null or min_participants <= max_participants),
  constraint events_capacity_chk   check (kind = 'tournament' or max_participants is not null),
  constraint events_canceled_chk   check (status <> 'canceled' or canceled_at is not null),
  constraint events_private_code_chk check (visibility = 'private' or invite_code is null),

  constraint events_court_no_overlap exclude using gist (
    court_id with =, tstzrange(starts_at, ends_at) with &&)
    where (court_id is not null and status not in ('draft', 'canceled'))
);

create index events_discovery_idx   on public.events (starts_at)
  where visibility = 'public' and status in ('open', 'full', 'in_progress');
create index events_geo_idx         on public.events (latitude, longitude);
create index events_sport_idx       on public.events (sport_id, starts_at);
create index events_organizer_idx   on public.events (organizer_id, starts_at desc);
create index events_status_ends_idx on public.events (status, ends_at);
create index events_venue_idx       on public.events (venue_id);
create index events_court_idx       on public.events (court_id);
create index events_series_idx      on public.events (series_id);
create index events_title_trgm_idx  on public.events using gin (public.immutable_unaccent(lower(title)) extensions.gin_trgm_ops);
create index events_place_trgm_idx  on public.events using gin (public.immutable_unaccent(lower(location_name)) extensions.gin_trgm_ops);

create trigger events_set_updated_at before update on public.events
  for each row execute function private.set_updated_at();

alter table public.notifications
  add constraint notifications_event_fk foreign key (event_id) references public.events(id) on delete cascade;

create table public.event_invites (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  invited_user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by      uuid references public.profiles(id) on delete set null,
  status          public.invite_status not null default 'pending',
  expires_at      timestamptz,
  created_at      timestamptz not null default now(),
  responded_at    timestamptz,
  unique (event_id, invited_user_id)
);
create index event_invites_user_idx on public.event_invites (invited_user_id, status);

create table public.event_join_requests (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  status     public.join_request_status not null default 'pending',
  message    text check (char_length(message) <= 300),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index event_join_requests_event_idx on public.event_join_requests (event_id, status);

create table public.event_registrations (
  id                    uuid primary key default gen_random_uuid(),
  event_id              uuid not null references public.events(id) on delete cascade,
  user_id               uuid not null references public.profiles(id) on delete cascade,
  status                public.registration_status not null default 'confirmed',
  queued_at             timestamp with time zone,
  confirmed_at          timestamptz,
  presence_confirmed_at timestamptz,
  attendance            public.attendance_status not null default 'unknown',
  checked_in_at         timestamptz,
  checked_in_by         uuid references public.profiles(id) on delete set null,
  hold_expires_at       timestamptz,
  canceled_at           timestamptz,
  cancel_reason         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (event_id, user_id),
  constraint event_registrations_attendance_chk check (attendance = 'unknown' or status = 'confirmed'),
  constraint event_registrations_hold_chk       check (hold_expires_at is null or status = 'confirmed'),
  constraint event_registrations_presence_chk   check (presence_confirmed_at is null or status = 'confirmed')
);
create index event_registrations_event_idx on public.event_registrations (event_id, status, created_at);
create index event_registrations_queue_idx on public.event_registrations (event_id, queued_at) where status = 'waitlisted';
create index event_registrations_user_idx  on public.event_registrations (user_id, created_at desc);
create index event_registrations_hold_idx  on public.event_registrations (hold_expires_at) where hold_expires_at is not null;
create index event_registrations_checked_in_by_idx on public.event_registrations (checked_in_by);

create trigger event_registrations_set_updated_at before update on public.event_registrations
  for each row execute function private.set_updated_at();

create function private.is_event_organizer(p_event uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.events where id = p_event and organizer_id = p_user) $$;

create function public.is_event_organizer(p_event uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select private.is_event_organizer(p_event, auth.uid()) $$;

create function public.is_registered_in_event(p_event uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.event_registrations
    where event_id = p_event and user_id = auth.uid() and status in ('confirmed', 'waitlisted'))
$$;

create function public.has_event_invite(p_event uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.event_invites
    where event_id = p_event and invited_user_id = auth.uid()
      and status in ('pending', 'accepted') and (expires_at is null or expires_at > now()))
$$;

alter table public.events enable row level security;
create policy events_select on public.events for select to authenticated using (
  (visibility = 'public' and status <> 'draft' and not public.is_blocked_with(organizer_id))
  or organizer_id = auth.uid()
  or public.is_registered_in_event(id)
  or public.has_event_invite(id));
create policy events_insert on public.events for insert to authenticated
  with check (organizer_id = auth.uid());
create policy events_update on public.events for update to authenticated
  using (organizer_id = auth.uid()) with check (organizer_id = auth.uid());
create policy events_delete on public.events for delete to authenticated
  using (organizer_id = auth.uid() and status = 'draft');

alter table public.event_registrations enable row level security;
create policy event_registrations_select on public.event_registrations for select to authenticated using (
  user_id = auth.uid()
  or public.is_event_organizer(event_id)
  or (status = 'confirmed' and exists (select 1 from public.events e where e.id = event_id)));

alter table public.event_invites enable row level security;
create policy event_invites_select on public.event_invites for select to authenticated
  using (invited_user_id = auth.uid() or public.is_event_organizer(event_id));

alter table public.event_join_requests enable row level security;
create policy event_join_requests_select on public.event_join_requests for select to authenticated
  using (user_id = auth.uid() or public.is_event_organizer(event_id));

create function private.event_audience(p_event uuid) returns setof uuid
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_kind public.event_kind;
  v_org  uuid;
begin
  select kind, organizer_id into v_kind, v_org from public.events where id = p_event;
  if v_kind = 'tournament' then
    return query
      select distinct m.user_id from public.tournament_team_members m
      join public.tournament_teams t on t.id = m.team_id
      where m.tournament_id = p_event and m.status = 'accepted'
        and t.status in ('pending', 'confirmed', 'waitlisted') and m.user_id is distinct from v_org;
  else
    return query
      select r.user_id from public.event_registrations r
      where r.event_id = p_event and r.status in ('confirmed', 'waitlisted')
        and r.user_id is distinct from v_org;
  end if;
end $$;

create function private.enforce_event_rules() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_system   boolean := coalesce(current_setting('app.system', true), 'off') = 'on';
  v_tz       text := private.setting_text('timezone', 'America/Sao_Paulo');
  v_plan     public.plans;
  v_count    int;
  v_creating boolean;
  v_court    public.courts;
  v_venue    public.venues;
begin

  if new.visibility = 'private' then
    if new.invite_code is null then new.invite_code := private.random_code(8); end if;
  else
    new.invite_code := null;
  end if;
  if new.status = 'canceled' and new.canceled_at is null then new.canceled_at := now(); end if;
  if new.kind = 'tournament' then
    new.max_participants := null;
    if new.price_cents <> 0 then
      raise exception 'tournament_fee_is_per_team' using errcode = 'P0001',
        detail = 'Use tournaments.entry_fee_cents; o evento do torneio fica com price_cents = 0.';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.status in ('finished', 'canceled') and not v_system then
    if (to_jsonb(new) - 'organizer_id' - 'venue_id' - 'court_id' - 'series_id' - 'updated_at')
       is distinct from
       (to_jsonb(old) - 'organizer_id' - 'venue_id' - 'court_id' - 'series_id' - 'updated_at') then
      raise exception 'event_closed' using errcode = 'P0001';
    end if;
  end if;

  if v_uid is not null and not v_system then
    if tg_op = 'INSERT' then
      if new.status not in ('draft', 'open') then
        raise exception 'invalid_status_transition' using errcode = 'P0001';
      end if;
      if new.organizer_id is distinct from v_uid then
        raise exception 'forbidden' using errcode = '42501';
      end if;
    else
      if new.organizer_id is not null and new.organizer_id is distinct from old.organizer_id then
        raise exception 'forbidden' using errcode = '42501';
      end if;
      if new.status is distinct from old.status and not (
           (old.status = 'draft' and new.status in ('open', 'canceled'))
        or (old.status in ('open', 'full', 'in_progress') and new.status = 'canceled')) then
        raise exception 'invalid_status_transition' using errcode = 'P0001',
          detail = old.status || ' -> ' || new.status;
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE' and not v_system and new.max_participants is not null
     and new.max_participants < old.confirmed_count then
    raise exception 'max_below_confirmed' using errcode = 'P0001', detail = 'confirmed=' || old.confirmed_count;
  end if;

  if not v_system and new.organizer_id is not null and new.status <> 'canceled' then
    v_creating := tg_op = 'INSERT' or (old.status = 'draft' and new.status <> 'draft');

    if v_creating and not private.has_permission(new.organizer_id, 'create_event') then
      raise exception 'plan_required' using errcode = 'P0001', detail = 'create_event';
    end if;
    v_plan := private.user_plan(new.organizer_id);

    if new.visibility = 'private' and (tg_op = 'INSERT' or old.visibility is distinct from new.visibility)
       and not private.has_permission(new.organizer_id, 'private_events') then
      raise exception 'plan_required' using errcode = 'P0001', detail = 'private_events';
    end if;
    if new.price_cents > 0 and (tg_op = 'INSERT' or old.price_cents is distinct from new.price_cents)
       and not private.has_permission(new.organizer_id, 'paid_events') then
      raise exception 'plan_required' using errcode = 'P0001', detail = 'paid_events';
    end if;
    if new.kind = 'tournament' and tg_op = 'INSERT'
       and not private.has_permission(new.organizer_id, 'create_tournament') then
      raise exception 'plan_required' using errcode = 'P0001', detail = 'create_tournament';
    end if;
    if new.promoted_until is not null and (tg_op = 'INSERT' or old.promoted_until is distinct from new.promoted_until)
       and not private.has_permission(new.organizer_id, 'promote_events') then
      raise exception 'plan_required' using errcode = 'P0001', detail = 'promote_events';
    end if;
    if new.series_id is not null and (tg_op = 'INSERT' or old.series_id is distinct from new.series_id)
       and not private.has_permission(new.organizer_id, 'recurring_events') then
      raise exception 'plan_required' using errcode = 'P0001', detail = 'recurring_events';
    end if;

    if new.kind <> 'tournament' and new.max_participants is not null
       and v_plan.max_participants_per_event is not null
       and (tg_op = 'INSERT' or old.max_participants is distinct from new.max_participants)
       and new.max_participants > v_plan.max_participants_per_event then
      raise exception 'plan_limit_exceeded' using errcode = 'P0001',
        detail = 'max_participants_per_event=' || v_plan.max_participants_per_event;
    end if;

    if new.kind <> 'tournament' and v_plan.max_events_per_week is not null and new.status <> 'draft'
       and (v_creating or tg_op = 'INSERT' or old.starts_at is distinct from new.starts_at) then
      select count(*) into v_count from public.events e
       where e.organizer_id = new.organizer_id and e.id <> new.id and e.kind <> 'tournament'
         and e.status not in ('draft', 'canceled')
         and date_trunc('week', e.starts_at at time zone v_tz) = date_trunc('week', new.starts_at at time zone v_tz);
      if v_count >= v_plan.max_events_per_week then
        raise exception 'plan_limit_exceeded' using errcode = 'P0001',
          detail = 'max_events_per_week=' || v_plan.max_events_per_week;
      end if;
    end if;

    if new.kind = 'tournament' and v_plan.max_active_tournaments is not null
       and new.status = 'open' and (tg_op = 'INSERT' or old.status = 'draft') then
      select count(*) into v_count from public.events e
       where e.organizer_id = new.organizer_id and e.id <> new.id and e.kind = 'tournament'
         and e.status in ('open', 'full', 'in_progress');
      if v_count >= v_plan.max_active_tournaments then
        raise exception 'plan_limit_exceeded' using errcode = 'P0001',
          detail = 'max_active_tournaments=' || v_plan.max_active_tournaments;
      end if;
    end if;

    if new.status <> 'draft' and (tg_op = 'INSERT' or old.status = 'draft')
       and new.starts_at < now() - interval '5 minutes' then
      raise exception 'starts_in_past' using errcode = 'P0001';
    end if;
  end if;

  if new.court_id is not null and (tg_op = 'INSERT' or new.court_id is distinct from old.court_id
                                   or new.sport_id is distinct from old.sport_id) then
    select * into v_court from public.courts where id = new.court_id;
    if not found or not v_court.is_active then
      raise exception 'court_unavailable' using errcode = 'P0001';
    end if;
    new.venue_id := v_court.venue_id;
    select * into v_venue from public.venues where id = v_court.venue_id;
    if v_venue.owner_id is not null and v_venue.owner_id is distinct from new.organizer_id and not v_system then
      raise exception 'court_not_allowed' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.court_sports where court_id = new.court_id)
       and not exists (select 1 from public.court_sports where court_id = new.court_id and sport_id = new.sport_id) then
      raise exception 'court_sport_mismatch' using errcode = 'P0001';
    end if;
  end if;

  return new;
end $$;

create trigger events_enforce_rules before insert or update on public.events
  for each row execute function private.enforce_event_rules();

create function private.events_after_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.organizer_id is not null and new.kind <> 'tournament' then
    insert into public.event_registrations (event_id, user_id, status)
    values (new.id, new.organizer_id, 'confirmed');
  end if;
  return null;
end $$;
create trigger events_after_insert after insert on public.events
  for each row execute function private.events_after_insert();

create function private.events_after_update() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  r uuid;
begin
  if new.status = 'canceled' and old.status <> 'canceled' then
    for r in select * from private.event_audience(new.id) loop
      perform private.notify(r, 'event_canceled', 'Evento cancelado',
        'O evento "' || new.title || '" foi cancelado pelo organizador.', new.id,
        jsonb_build_object('reason', new.cancel_reason));
    end loop;
  elsif old.status <> 'draft' and new.status <> 'draft' and (
        new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at
     or new.location_name is distinct from old.location_name or new.address is distinct from old.address
     or new.latitude is distinct from old.latitude or new.longitude is distinct from old.longitude) then
    for r in select * from private.event_audience(new.id) loop
      perform private.notify(r, 'event_updated', 'Evento atualizado',
        'O evento "' || new.title || '" foi atualizado pelo organizador.', new.id, '{}'::jsonb);
    end loop;
  end if;

  if new.status = 'full' and old.status = 'open' then
    perform private.notify(new.organizer_id, 'event_full', 'Evento lotado',
      'O evento "' || new.title || '" atingiu o limite de vagas.', new.id, '{}'::jsonb);
  end if;

  if new.max_participants is distinct from old.max_participants and new.status in ('open', 'full') then
    perform private.sync_event_capacity(new.id);
  end if;
  return null;
end $$;
create trigger events_after_update after update on public.events
  for each row execute function private.events_after_update();

create function private.sync_event_capacity(p_event uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  e        public.events;
  v_conf   int;
  v_wait   int;
  v_next   uuid;
  v_prev   text := coalesce(current_setting('app.system', true), 'off');
begin
  select * into e from public.events where id = p_event for update;
  if not found or e.kind = 'tournament' then return; end if;

  select count(*) filter (where status = 'confirmed'), count(*) filter (where status = 'waitlisted')
    into v_conf, v_wait
    from public.event_registrations where event_id = p_event;

  perform set_config('app.system', 'on', true);

  if v_conf <> e.confirmed_count or v_wait <> e.waitlist_count then
    update public.events set confirmed_count = v_conf, waitlist_count = v_wait where id = p_event;
  end if;

  if e.status in ('open', 'full') then
    if v_wait > 0 and (e.max_participants is null or v_conf < e.max_participants) then

      select id into v_next from public.event_registrations
       where event_id = p_event and status = 'waitlisted'
       order by queued_at, created_at limit 1;
      update public.event_registrations set status = 'confirmed' where id = v_next;
    elsif e.status = 'open' and e.max_participants is not null and v_conf >= e.max_participants then
      update public.events set status = 'full' where id = p_event;
    elsif e.status = 'full' and (e.max_participants is null or v_conf < e.max_participants) then
      update public.events set status = 'open' where id = p_event;
    end if;
  end if;

  perform set_config('app.system', v_prev, true);
end $$;

create function private.enforce_registration_rules() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  e           public.events;
  v_system    boolean := coalesce(current_setting('app.system', true), 'off') = 'on';
  v_code_ok   boolean := coalesce(current_setting('app.join_access', true), 'off') = 'on';
  v_is_org    boolean;
  v_entering  boolean;
  v_promoting boolean;
  v_confirmed int;
  v_invited   boolean;
  v_approved  boolean;
begin

  select * into e from public.events where id = new.event_id for update;
  if not found then raise exception 'event_not_found' using errcode = 'P0002'; end if;
  if e.kind = 'tournament' then
    raise exception 'use_tournament_registration' using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' and (new.event_id <> old.event_id or new.user_id <> old.user_id) then
    raise exception 'immutable_registration' using errcode = 'P0001';
  end if;

  v_is_org    := new.user_id is not distinct from e.organizer_id;
  v_entering  := tg_op = 'INSERT' or (old.status = 'canceled' and new.status in ('confirmed', 'waitlisted'));
  v_promoting := tg_op = 'UPDATE' and old.status = 'waitlisted' and new.status = 'confirmed';

  if v_entering and new.status in ('confirmed', 'waitlisted') then
    if not v_system then
      if e.status = 'draft' then
        if not v_is_org then raise exception 'event_not_open' using errcode = 'P0001'; end if;
      elsif e.status not in ('open', 'full') then
        raise exception 'event_not_open' using errcode = 'P0001', detail = e.status::text;
      end if;
      if not v_is_org and e.registration_deadline is not null and now() > e.registration_deadline then
        raise exception 'registration_closed' using errcode = 'P0001';
      end if;
      if now() >= e.ends_at then
        raise exception 'event_finished' using errcode = 'P0001';
      end if;
    end if;

    if not private.profile_ready_for_events(new.user_id) then
      raise exception 'profile_incomplete' using errcode = 'P0001',
        detail = 'Informe data de nascimento e gênero no perfil para entrar em eventos.';
    end if;

    if not v_is_org then
      if private.is_blocked_between(new.user_id, e.organizer_id) then
        raise exception 'blocked' using errcode = 'P0001';
      end if;
      if not v_system then
        v_invited := exists (select 1 from public.event_invites i
          where i.event_id = e.id and i.invited_user_id = new.user_id
            and i.status in ('pending', 'accepted') and (i.expires_at is null or i.expires_at > now()));
        v_approved := exists (select 1 from public.event_join_requests q
          where q.event_id = e.id and q.user_id = new.user_id and q.status = 'approved');
        if e.requires_approval and not (v_invited or v_approved) then
          raise exception 'approval_required' using errcode = 'P0001';
        end if;
        if e.visibility = 'private' and not (v_invited or v_approved or v_code_ok) then
          raise exception 'event_private' using errcode = 'P0001';
        end if;
      end if;
    end if;
  end if;

  if new.status = 'confirmed' and (v_entering or v_promoting) and e.max_participants is not null then
    select count(*) into v_confirmed from public.event_registrations
     where event_id = e.id and status = 'confirmed' and id <> new.id;
    if v_confirmed >= e.max_participants then
      if v_promoting then
        raise exception 'event_full' using errcode = 'P0001';
      elsif e.waitlist_enabled then
        new.status := 'waitlisted';
      else
        raise exception 'event_full' using errcode = 'P0001';
      end if;
    end if;
  end if;

  if v_entering and tg_op = 'UPDATE' then
    new.presence_confirmed_at := null;
    new.attendance := 'unknown';
    new.checked_in_at := null;
    new.checked_in_by := null;
    new.canceled_at := null;
    new.cancel_reason := null;
  end if;

  if new.status = 'waitlisted' and (v_entering or tg_op = 'INSERT') then
    new.queued_at := now();
    new.confirmed_at := null;
    new.hold_expires_at := null;
  elsif new.status = 'confirmed' and (v_entering or v_promoting) then
    new.confirmed_at := now();
    new.queued_at := null;

    if e.price_cents > 0 and not v_is_org then
      new.hold_expires_at := now() + make_interval(mins => private.setting_int('payment_hold_minutes', 15));
    else
      new.hold_expires_at := null;
    end if;
  end if;

  if new.status = 'canceled' and (tg_op = 'INSERT' or old.status <> 'canceled') then
    if not v_system and e.status in ('in_progress', 'finished') then
      raise exception 'event_already_started' using errcode = 'P0001';
    end if;
    new.canceled_at := now();
    new.hold_expires_at := null;
    new.presence_confirmed_at := null;
    new.attendance := 'unknown';
    new.checked_in_at := null;
    new.queued_at := null;
  end if;

  if tg_op = 'UPDATE' and e.status = 'finished' and not v_system and new.status is distinct from old.status then
    raise exception 'event_finished' using errcode = 'P0001';
  end if;

  if new.attendance = 'present' and (tg_op = 'INSERT' or old.attendance <> 'present') then
    new.checked_in_at := coalesce(new.checked_in_at, now());
    new.checked_in_by := coalesce(new.checked_in_by, auth.uid());
  end if;

  return new;
end $$;

create trigger event_registrations_enforce_rules before insert or update on public.event_registrations
  for each row execute function private.enforce_registration_rules();

create function private.registrations_after_write() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  e public.events;
begin
  if tg_op = 'DELETE' then
    perform private.sync_event_capacity(old.event_id);
    return null;
  end if;

  select * into e from public.events where id = new.event_id;

  if new.status = 'confirmed' and new.user_id is distinct from e.organizer_id then
    if tg_op = 'INSERT' or old.status = 'canceled' then
      perform private.notify(new.user_id, 'registration_confirmed', 'Inscrição confirmada',
        case when new.hold_expires_at is not null
             then 'Vaga reservada em "' || e.title || '". Conclua o pagamento para garantir.'
             else 'Você está confirmado em "' || e.title || '".' end,
        e.id, jsonb_build_object('registration_id', new.id));
    elsif old.status = 'waitlisted' then
      perform private.notify(new.user_id, 'waitlist_promoted', 'Você entrou no evento',
        'Abriu uma vaga em "' || e.title || '" e você saiu da lista de espera.',
        e.id, jsonb_build_object('registration_id', new.id));
    end if;
  elsif new.status = 'canceled' and old.status = 'confirmed' and new.cancel_reason = 'payment_timeout' then
    perform private.notify(new.user_id, 'registration_expired', 'Reserva expirada',
      'O prazo para pagar a vaga em "' || e.title || '" terminou e a reserva foi liberada.',
      e.id, jsonb_build_object('registration_id', new.id));
  end if;

  perform private.sync_event_capacity(new.event_id);
  return null;
end $$;

create trigger event_registrations_after_insert_update after insert or update of status on public.event_registrations
  for each row execute function private.registrations_after_write();
create trigger event_registrations_after_delete after delete on public.event_registrations
  for each row execute function private.registrations_after_write();

create function private.invites_after_write() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  e public.events;
  v_name text;
begin
  select * into e from public.events where id = new.event_id;
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
    select name into v_name from public.profiles where id = new.invited_by;
    perform private.notify(new.invited_user_id, 'event_invite', 'Convite para evento',
      coalesce(v_name, 'O organizador') || ' convidou você para "' || e.title || '".', e.id,
      jsonb_build_object('invite_id', new.id));
  end if;
  return null;
end $$;
create trigger event_invites_after_write after insert or update of status on public.event_invites
  for each row execute function private.invites_after_write();

create function private.join_requests_after_write() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  e public.events;
  v_name text;
begin
  select * into e from public.events where id = new.event_id;
  if tg_op = 'INSERT' or (new.status = 'pending' and old.status <> 'pending') then
    select name into v_name from public.profiles where id = new.user_id;
    perform private.notify(e.organizer_id, 'join_request', 'Pedido para entrar',
      v_name || ' quer entrar em "' || e.title || '".', e.id,
      jsonb_build_object('request_id', new.id, 'user_id', new.user_id));
  elsif new.status in ('approved', 'rejected') and old.status = 'pending' then
    perform private.notify(new.user_id, 'join_request_decided',
      case new.status when 'approved' then 'Pedido aprovado' else 'Pedido recusado' end,
      case new.status when 'approved' then 'Você foi aprovado em "' || e.title || '".'
                      else 'Seu pedido para "' || e.title || '" foi recusado.' end,
      e.id, jsonb_build_object('request_id', new.id));
  end if;
  return null;
end $$;
create trigger event_join_requests_after_write after insert or update of status on public.event_join_requests
  for each row execute function private.join_requests_after_write();

create function private.register_user(p_event uuid, p_user uuid) returns public.event_registrations
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  r public.event_registrations;
begin
  select * into r from public.event_registrations where event_id = p_event and user_id = p_user;
  if found then
    if r.status in ('confirmed', 'waitlisted') then return r; end if;
    update public.event_registrations set status = 'confirmed' where id = r.id returning * into r;
  else
    insert into public.event_registrations (event_id, user_id, status)
    values (p_event, p_user, 'confirmed') returning * into r;
  end if;
  return r;
end $$;

create function public.join_event(p_event_id uuid, p_invite_code text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  e          public.events;
  r          public.event_registrations;
  q          public.event_join_requests;
  v_invited  boolean;
  v_approved boolean;
  v_before   public.registration_status;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not private.has_permission(v_uid, 'join_events') then
    raise exception 'plan_required' using errcode = 'P0001', detail = 'join_events';
  end if;

  select * into e from public.events where id = p_event_id;
  if not found then raise exception 'event_not_found' using errcode = 'P0002'; end if;
  if e.kind = 'tournament' then raise exception 'use_tournament_registration' using errcode = 'P0001'; end if;

  v_invited := exists (select 1 from public.event_invites i
    where i.event_id = e.id and i.invited_user_id = v_uid and i.status in ('pending', 'accepted')
      and (i.expires_at is null or i.expires_at > now()));
  v_approved := exists (select 1 from public.event_join_requests where event_id = e.id and user_id = v_uid and status = 'approved');

  if e.visibility = 'private' and e.organizer_id is distinct from v_uid and not v_invited and not v_approved then
    if p_invite_code is null or lower(p_invite_code) <> lower(coalesce(e.invite_code, '')) then
      raise exception 'event_not_found' using errcode = 'P0002';
    end if;
    perform set_config('app.join_access', 'on', true);
  end if;
  if e.status = 'draft' and e.organizer_id is distinct from v_uid then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;

  if e.requires_approval and e.organizer_id is distinct from v_uid and not v_invited and not v_approved then
    select * into q from public.event_join_requests where event_id = e.id and user_id = v_uid;
    if found then
      if q.status = 'pending' then
        return jsonb_build_object('result', 'pending_approval', 'request_id', q.id);
      elsif q.status = 'rejected' then
        raise exception 'join_request_rejected' using errcode = 'P0001';
      end if;
      update public.event_join_requests set status = 'pending', decided_by = null, decided_at = null
       where id = q.id returning * into q;
    else
      insert into public.event_join_requests (event_id, user_id) values (e.id, v_uid) returning * into q;
    end if;
    return jsonb_build_object('result', 'pending_approval', 'request_id', q.id);
  end if;

  select status into v_before from public.event_registrations where event_id = e.id and user_id = v_uid;
  r := private.register_user(e.id, v_uid);

  update public.event_invites set status = 'accepted', responded_at = now()
   where event_id = e.id and invited_user_id = v_uid and status = 'pending';

  return jsonb_build_object(
    'result', case when v_before in ('confirmed', 'waitlisted') then 'already_registered' else r.status::text end,
    'status', r.status, 'registration_id', r.id, 'hold_expires_at', r.hold_expires_at);
end $$;

create function public.leave_event(p_event_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.event_registrations
     set status = 'canceled'
   where event_id = p_event_id and user_id = auth.uid() and status in ('confirmed', 'waitlisted');
  if not found then raise exception 'not_registered' using errcode = 'P0002'; end if;
end $$;

create function public.confirm_presence(p_event_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.event_registrations r
     set presence_confirmed_at = now()
   where r.event_id = p_event_id and r.user_id = auth.uid() and r.status = 'confirmed'
     and exists (select 1 from public.events e where e.id = r.event_id and e.status in ('open', 'full', 'in_progress'));
  if not found then raise exception 'not_registered' using errcode = 'P0002'; end if;
end $$;

create function public.check_in_participant(
  p_event_id uuid, p_user_id uuid, p_attendance public.attendance_status
) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not private.is_event_organizer(p_event_id, v_uid) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not private.has_permission(v_uid, 'manage_attendance') then
    raise exception 'plan_required' using errcode = 'P0001', detail = 'manage_attendance';
  end if;
  if not exists (select 1 from public.events where id = p_event_id and status in ('open', 'full', 'in_progress', 'finished')) then
    raise exception 'event_not_open' using errcode = 'P0001';
  end if;
  update public.event_registrations
     set attendance = p_attendance,
         checked_in_at = case when p_attendance = 'present' then now() end,
         checked_in_by = case when p_attendance = 'present' then v_uid end
   where event_id = p_event_id and user_id = p_user_id and status = 'confirmed';
  if not found then raise exception 'not_registered' using errcode = 'P0002'; end if;
end $$;

create function public.lookup_event_by_code(p_code text)
returns table (id uuid, title text, sport_id smallint, kind public.event_kind, status public.event_status,
               starts_at timestamptz, ends_at timestamptz, location_name text, city text,
               requires_approval boolean, price_cents int, spots_left int)
language sql stable security definer set search_path = public, pg_temp
as $$
  select e.id, e.title, e.sport_id, e.kind, e.status, e.starts_at, e.ends_at, e.location_name, e.city,
         e.requires_approval, e.price_cents,
         case when e.max_participants is null then null else greatest(e.max_participants - e.confirmed_count, 0) end
  from public.events e
  where auth.uid() is not null and e.invite_code is not null
    and lower(e.invite_code) = lower(p_code) and e.status <> 'draft'
$$;

create function public.invite_user_to_event(p_event_id uuid, p_user_id uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if not private.is_event_organizer(p_event_id, v_uid) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user_id = v_uid then raise exception 'invalid_invite' using errcode = 'P0001'; end if;
  if exists (select 1 from public.events where id = p_event_id and status in ('finished', 'canceled')) then
    raise exception 'event_closed' using errcode = 'P0001';
  end if;
  if private.is_blocked_between(v_uid, p_user_id) then raise exception 'blocked' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  insert into public.event_invites (event_id, invited_user_id, invited_by, expires_at)
  values (p_event_id, p_user_id, v_uid, now() + make_interval(days => private.setting_int('invite_valid_days', 7)))
  on conflict (event_id, invited_user_id) do update
    set status = 'pending', invited_by = excluded.invited_by, expires_at = excluded.expires_at, responded_at = null
    where public.event_invites.status in ('declined', 'revoked', 'expired')
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.event_invites where event_id = p_event_id and invited_user_id = p_user_id;
  end if;
  return v_id;
end $$;

create function public.respond_event_invite(p_invite_id uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  i     public.event_invites;
  r     public.event_registrations;
begin
  select * into i from public.event_invites where id = p_invite_id and invited_user_id = v_uid for update;
  if not found or i.status <> 'pending' or (i.expires_at is not null and i.expires_at <= now()) then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;
  if not p_accept then
    update public.event_invites set status = 'declined', responded_at = now() where id = i.id;
    return jsonb_build_object('result', 'declined');
  end if;
  r := private.register_user(i.event_id, v_uid);
  update public.event_invites set status = 'accepted', responded_at = now() where id = i.id;
  return jsonb_build_object('result', r.status::text, 'registration_id', r.id);
end $$;

create function public.revoke_event_invite(p_invite_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.event_invites i set status = 'revoked', responded_at = now()
   where i.id = p_invite_id and i.status = 'pending' and private.is_event_organizer(i.event_id, auth.uid());
  if not found then raise exception 'invite_not_found' using errcode = 'P0002'; end if;
end $$;

create function public.decide_join_request(p_request_id uuid, p_approve boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  q     public.event_join_requests;
  r     public.event_registrations;
begin
  select * into q from public.event_join_requests where id = p_request_id for update;
  if not found or not private.is_event_organizer(q.event_id, v_uid) then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;
  if q.status <> 'pending' then raise exception 'request_already_decided' using errcode = 'P0001'; end if;

  update public.event_join_requests
     set status = case when p_approve then 'approved'::public.join_request_status else 'rejected'::public.join_request_status end,
         decided_by = v_uid, decided_at = now()
   where id = q.id;
  if not p_approve then return jsonb_build_object('result', 'rejected'); end if;

  r := private.register_user(q.event_id, q.user_id);
  return jsonb_build_object('result', r.status::text, 'registration_id', r.id);
end $$;

create function public.cancel_join_request(p_request_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.event_join_requests set status = 'canceled'
   where id = p_request_id and user_id = auth.uid() and status = 'pending';
  if not found then raise exception 'request_not_found' using errcode = 'P0002'; end if;
end $$;

create function public.create_event_series(
  p_event_id    uuid,
  p_frequency   public.recurrence_frequency,
  p_interval    smallint default 1,
  p_weekdays    smallint[] default null,
  p_occurrences int default 4,
  p_until       date default null
) returns int
language plpgsql set search_path = public
as $$
declare
  e          public.events;
  v_series   uuid;
  v_tz       text := coalesce((select value #>> '{}' from public.app_settings where key = 'timezone'), 'America/Sao_Paulo');
  d0         date;
  t0         time;
  dur        interval;
  d          date;
  v_set      smallint[];
  v_created  int := 1;
  v_ok       boolean;
  v_start    timestamptz;
begin
  if p_occurrences < 2 or p_occurrences > 52 then raise exception 'invalid_occurrences' using errcode = 'P0001'; end if;
  if p_interval < 1 or p_interval > 52 then raise exception 'invalid_interval' using errcode = 'P0001'; end if;

  select * into e from public.events where id = p_event_id;
  if not found or e.organizer_id is distinct from auth.uid() then raise exception 'forbidden' using errcode = '42501'; end if;
  if e.series_id is not null then raise exception 'already_in_series' using errcode = 'P0001'; end if;
  if e.kind = 'tournament' then raise exception 'series_not_supported_for_tournaments' using errcode = 'P0001'; end if;
  if not public.i_have_permission('recurring_events') then
    raise exception 'plan_required' using errcode = 'P0001', detail = 'recurring_events';
  end if;

  d0  := (e.starts_at at time zone v_tz)::date;
  t0  := (e.starts_at at time zone v_tz)::time;
  dur := e.ends_at - e.starts_at;
  v_set := coalesce(p_weekdays, array[extract(dow from d0)::smallint]);

  insert into public.event_series (organizer_id, frequency, interval_count, weekdays, until_date)
  values (auth.uid(), p_frequency, p_interval, case when p_frequency = 'weekly' then v_set end, p_until)
  returning id into v_series;

  update public.events set series_id = v_series, series_position = 1 where id = e.id;

  for i in 1..800 loop
    exit when v_created >= p_occurrences;
    d := d0 + i;
    exit when p_until is not null and d > p_until;

    v_ok := case p_frequency
      when 'daily'   then (i % p_interval) = 0
      when 'weekly'  then extract(dow from d)::smallint = any (v_set)
                          and (((date_trunc('week', d::timestamp)::date - date_trunc('week', d0::timestamp)::date) / 7) % p_interval) = 0
      when 'monthly' then extract(day from d) = extract(day from d0)
                          and ((((extract(year from d) * 12 + extract(month from d))
                               - (extract(year from d0) * 12 + extract(month from d0)))::int) % p_interval) = 0
    end;
    continue when not v_ok;

    v_start := (d + t0) at time zone v_tz;
    insert into public.events (
      organizer_id, sport_id, venue_id, court_id, title, description, kind, visibility, status, skill_level,
      starts_at, ends_at, registration_deadline, location_name, address, city, state, latitude, longitude,
      max_participants, min_participants, waitlist_enabled, requires_approval, price_cents, currency, rules,
      series_id, series_position)
    values (
      e.organizer_id, e.sport_id, e.venue_id, e.court_id, e.title, e.description, e.kind, e.visibility, e.status, e.skill_level,
      v_start, v_start + dur,
      case when e.registration_deadline is null then null else v_start - (e.starts_at - e.registration_deadline) end,
      e.location_name, e.address, e.city, e.state, e.latitude, e.longitude,
      e.max_participants, e.min_participants, e.waitlist_enabled, e.requires_approval, e.price_cents, e.currency, e.rules,
      v_series, v_created + 1);
    v_created := v_created + 1;
  end loop;

  return v_created;
end $$;

create function public.search_events_nearby(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int default 10000,
  p_sports text[] default null,
  p_query text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_day_time_from time default null,
  p_day_time_to time default null,
  p_skill public.skill_level default null,
  p_free_only boolean default false,
  p_only_available boolean default false,
  p_prioritize_my_sports boolean default true,
  p_limit int default 50,
  p_offset int default 0
) returns table (
  id uuid, title text, sport_slug text, sport_name text, sport_color text,
  kind public.event_kind, status public.event_status, visibility public.event_visibility,
  starts_at timestamptz, ends_at timestamptz, location_name text, address text, city text,
  latitude double precision, longitude double precision, distance_m double precision,
  max_participants int, confirmed_count int, spots_left int, price_cents int,
  skill_level public.skill_level, is_promoted boolean,
  organizer_id uuid, organizer_name text, is_organizer boolean, is_participant boolean,
  my_sport_position smallint
)
language sql stable set search_path = public
as $$
  with cfg as (
    select coalesce((select value #>> '{}' from public.app_settings where key = 'timezone'), 'America/Sao_Paulo') as tz
  )
  select
    e.id, e.title, s.slug, s.name, s.color,
    e.kind, e.status, e.visibility,
    e.starts_at, e.ends_at, e.location_name, e.address, e.city,
    e.latitude, e.longitude,
    public.distance_meters(p_lat, p_lng, e.latitude, e.longitude),
    e.max_participants, e.confirmed_count,
    case when e.max_participants is null then null else greatest(e.max_participants - e.confirmed_count, 0) end,
    e.price_cents, e.skill_level,
    (e.promoted_until is not null and e.promoted_until > now()),
    e.organizer_id, pp.name,
    (e.organizer_id = auth.uid()),
    exists (select 1 from public.event_registrations r
             where r.event_id = e.id and r.user_id = auth.uid() and r.status in ('confirmed', 'waitlisted')),
    us.position
  from public.events e
  cross join cfg
  join public.sports s on s.id = e.sport_id
  left join public.user_sports us on us.user_id = auth.uid() and us.sport_id = e.sport_id
  left join public.public_profiles pp on pp.id = e.organizer_id
  where e.status in ('open', 'full', 'in_progress')
    and e.ends_at >= coalesce(p_from, now())
    and (p_to is null or e.starts_at <= p_to)

    and e.latitude  between p_lat - (p_radius_m / 111320.0) and p_lat + (p_radius_m / 111320.0)
    and e.longitude between p_lng - (p_radius_m / (111320.0 * greatest(cos(radians(p_lat)), 0.01)))
                        and p_lng + (p_radius_m / (111320.0 * greatest(cos(radians(p_lat)), 0.01)))
    and public.distance_meters(p_lat, p_lng, e.latitude, e.longitude) <= p_radius_m
    and (p_sports is null or s.slug = any (p_sports))
    and (p_skill is null or e.skill_level is null or e.skill_level = p_skill)
    and (not p_free_only or e.price_cents = 0)
    and (not p_only_available or e.status = 'open')
    and (p_query is null or p_query = ''
         or public.immutable_unaccent(lower(e.title))         like '%' || public.immutable_unaccent(lower(p_query)) || '%'
         or public.immutable_unaccent(lower(e.location_name)) like '%' || public.immutable_unaccent(lower(p_query)) || '%'
         or public.immutable_unaccent(lower(s.name))          like '%' || public.immutable_unaccent(lower(p_query)) || '%')
    and (p_day_time_from is null or (e.starts_at at time zone cfg.tz)::time >= p_day_time_from)
    and (p_day_time_to   is null or (e.starts_at at time zone cfg.tz)::time <= p_day_time_to)
  order by
    case when p_prioritize_my_sports and us.position is not null then 0 else 1 end,
    case when p_prioritize_my_sports then us.position end nulls last,
    (e.promoted_until is not null and e.promoted_until > now()) desc,
    public.distance_meters(p_lat, p_lng, e.latitude, e.longitude),
    e.starts_at
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)
$$;

create view public.events_with_availability with (security_invoker = true) as
select e.*, s.slug as sport_slug, s.name as sport_name, s.color as sport_color,
       case when e.max_participants is null then null
            else greatest(e.max_participants - e.confirmed_count, 0) end as spots_left
from public.events e
join public.sports s on s.id = e.sport_id;

create view public.user_event_history with (security_invoker = true) as
select r.user_id, r.id as registration_id, r.status as registration_status, r.attendance,
       r.checked_in_at, r.presence_confirmed_at,
       e.id as event_id, e.title, e.kind, e.status as event_status, e.starts_at, e.ends_at,
       e.location_name, e.city, e.latitude, e.longitude, e.organizer_id,
       (e.organizer_id = r.user_id) as was_organizer,
       s.slug as sport_slug, s.name as sport_name
from public.event_registrations r
join public.events e on e.id = r.event_id
join public.sports s on s.id = e.sport_id
where r.user_id = auth.uid();

create view public.user_sport_stats with (security_invoker = true) as
select h.user_id, h.sport_slug, h.sport_name,
       count(*) as events_played,
       count(*) filter (where h.attendance = 'present') as events_attended,
       count(*) filter (where h.attendance = 'absent')  as events_missed,
       max(h.ends_at) as last_played_at
from public.user_event_history h
where h.registration_status = 'confirmed' and h.event_status = 'finished'
group by h.user_id, h.sport_slug, h.sport_name;

create table public.event_team_draws (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  mode       public.draw_mode not null,
  team_count smallint not null check (team_count between 2 and 50),
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index event_team_draws_one_current on public.event_team_draws (event_id) where is_current;
create index event_team_draws_created_by_idx on public.event_team_draws (created_by);

create table public.event_teams (
  id       uuid primary key default gen_random_uuid(),
  draw_id  uuid not null references public.event_team_draws(id) on delete cascade,
  name     text not null,
  position smallint not null,
  unique (draw_id, position),
  unique (id, draw_id)
);

create table public.event_team_members (
  team_id uuid not null,
  draw_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (team_id, user_id),
  unique (draw_id, user_id),
  foreign key (team_id, draw_id) references public.event_teams (id, draw_id) on delete cascade
);
create index event_team_members_user_idx on public.event_team_members (user_id);

alter table public.event_team_draws enable row level security;
create policy event_team_draws_select on public.event_team_draws for select to authenticated
  using (public.is_event_organizer(event_id) or public.is_registered_in_event(event_id));
alter table public.event_teams enable row level security;
create policy event_teams_select on public.event_teams for select to authenticated
  using (exists (select 1 from public.event_team_draws d where d.id = draw_id));
alter table public.event_team_members enable row level security;
create policy event_team_members_select on public.event_team_members for select to authenticated
  using (exists (select 1 from public.event_team_draws d where d.id = draw_id));

create function public.draw_event_teams(
  p_event_id uuid, p_team_count smallint, p_mode public.draw_mode default 'random'
) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  e       public.events;
  v_n     int;
  v_draw  uuid;
  v_teams uuid[] := '{}';
  v_id    uuid;
  r       record;
  i       int := 0;
  v_team  int;
begin
  select * into e from public.events where id = p_event_id;
  if not found or e.organizer_id is distinct from v_uid then raise exception 'forbidden' using errcode = '42501'; end if;
  if not private.has_permission(v_uid, 'team_draw') then
    raise exception 'plan_required' using errcode = 'P0001', detail = 'team_draw';
  end if;
  if e.kind = 'tournament' or e.status not in ('open', 'full', 'in_progress') then
    raise exception 'event_not_open' using errcode = 'P0001';
  end if;
  if p_team_count < 2 then raise exception 'invalid_team_count' using errcode = 'P0001'; end if;

  select count(*) into v_n from public.event_registrations where event_id = p_event_id and status = 'confirmed';
  if v_n < p_team_count then raise exception 'not_enough_participants' using errcode = 'P0001'; end if;

  update public.event_team_draws set is_current = false where event_id = p_event_id and is_current;
  insert into public.event_team_draws (event_id, created_by, mode, team_count)
  values (p_event_id, v_uid, p_mode, p_team_count) returning id into v_draw;

  for k in 1..p_team_count loop
    insert into public.event_teams (draw_id, name, position) values (v_draw, 'Time ' || k, k) returning id into v_id;
    v_teams := v_teams || v_id;
  end loop;

  for r in
    select reg.user_id
    from public.event_registrations reg
    left join public.user_sports us on us.user_id = reg.user_id and us.sport_id = e.sport_id
    where reg.event_id = p_event_id and reg.status = 'confirmed'
    order by case when p_mode = 'balanced' then -coalesce(public.skill_rank(us.skill_level), 2) end, random()
  loop
    v_team := i % p_team_count;
    if p_mode = 'balanced' and (i / p_team_count) % 2 = 1 then v_team := p_team_count - 1 - v_team; end if;
    insert into public.event_team_members (team_id, draw_id, user_id) values (v_teams[v_team + 1], v_draw, r.user_id);
    i := i + 1;
  end loop;

  return v_draw;
end $$;

create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  kind        public.review_kind not null,
  rating      smallint not null check (rating between 1 and 5),
  comment     text check (char_length(comment) <= 500),
  created_at  timestamptz not null default now(),
  unique (event_id, reviewer_id, reviewee_id),
  check (reviewer_id <> reviewee_id)
);
create index reviews_reviewee_idx on public.reviews (reviewee_id, kind);
create index reviews_reviewer_idx on public.reviews (reviewer_id);

alter table public.reviews enable row level security;
create policy reviews_select on public.reviews for select to authenticated
  using (reviewer_id = auth.uid() or reviewee_id = auth.uid());
create policy reviews_insert on public.reviews for insert to authenticated with check (reviewer_id = auth.uid());
create policy reviews_update on public.reviews for update to authenticated
  using (reviewer_id = auth.uid()) with check (reviewer_id = auth.uid());
create policy reviews_delete on public.reviews for delete to authenticated using (reviewer_id = auth.uid());

create function private.reviews_before_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  e public.events;
begin
  select * into e from public.events where id = new.event_id;
  if e.status <> 'finished' then raise exception 'event_not_finished' using errcode = 'P0001'; end if;
  if now() > e.ends_at + make_interval(days => private.setting_int('review_window_days', 14)) then
    raise exception 'review_window_closed' using errcode = 'P0001';
  end if;
  if private.is_blocked_between(new.reviewer_id, new.reviewee_id) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.event_registrations
                  where event_id = new.event_id and user_id = new.reviewer_id
                    and status = 'confirmed' and attendance <> 'absent')
     or not exists (select 1 from public.event_registrations
                     where event_id = new.event_id and user_id = new.reviewee_id
                       and status = 'confirmed' and attendance <> 'absent') then
    raise exception 'not_a_participant' using errcode = 'P0001';
  end if;

  new.kind := case when new.reviewee_id = e.organizer_id then 'organizer' else 'participant' end;
  return new;
end $$;
create trigger reviews_before_insert before insert on public.reviews
  for each row execute function private.reviews_before_insert();

create function private.reviews_after_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform private.notify(new.reviewee_id, 'review_received', 'Você recebeu uma avaliação',
    'Uma pessoa avaliou você após o evento.', new.event_id, jsonb_build_object('rating', new.rating));
  return null;
end $$;
create trigger reviews_after_insert after insert on public.reviews
  for each row execute function private.reviews_after_insert();

create view public.user_ratings as
select r.reviewee_id as user_id, r.kind,
       round(avg(r.rating)::numeric, 2) as avg_rating,
       count(*) as reviews_count
from public.reviews r
where auth.uid() is not null and not public.is_blocked_with(r.reviewee_id)
group by r.reviewee_id, r.kind;
