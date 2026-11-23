set search_path = public, extensions;

create type public.team_status       as enum ('pending', 'confirmed', 'waitlisted', 'rejected', 'canceled');
create type public.team_member_status as enum ('invited', 'accepted', 'declined');
create type public.team_member_role  as enum ('captain', 'player');
create type public.phase_format      as enum ('group_stage', 'knockout', 'round_robin');
create type public.match_status      as enum ('scheduled', 'in_progress', 'finished', 'walkover', 'canceled');

create table public.tournaments (
  event_id             uuid primary key references public.events(id) on delete cascade,
  entry_fee_cents      int not null default 0 check (entry_fee_cents >= 0),
  max_teams            int not null check (max_teams >= 2),
  min_teams            int check (min_teams >= 2),
  players_per_team_min smallint not null default 1 check (players_per_team_min >= 1),
  players_per_team_max smallint not null default 1,
  prize_description    text check (char_length(prize_description) <= 500),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint tournaments_team_size_chk check (players_per_team_max >= players_per_team_min),
  constraint tournaments_min_max_chk   check (min_teams is null or min_teams <= max_teams)
);
create trigger tournaments_set_updated_at before update on public.tournaments
  for each row execute function private.set_updated_at();

create table public.tournament_phases (
  id               uuid primary key default gen_random_uuid(),
  tournament_id    uuid not null references public.tournaments(event_id) on delete cascade,
  position         smallint not null check (position >= 1),
  name             text not null check (char_length(btrim(name)) >= 2),
  format           public.phase_format not null,
  points_win       smallint not null default 3,
  points_draw      smallint not null default 1,
  points_loss      smallint not null default 0,
  legs             smallint not null default 1 check (legs in (1, 2)),
  advance_per_group smallint check (advance_per_group >= 1),
  third_place_match boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (tournament_id, position),
  unique (id, tournament_id)
);

create table public.tournament_groups (
  id            uuid primary key default gen_random_uuid(),
  phase_id      uuid not null,
  tournament_id uuid not null,
  name          text not null,
  unique (phase_id, name),
  unique (id, phase_id),
  foreign key (phase_id, tournament_id) references public.tournament_phases (id, tournament_id) on delete cascade
);

create table public.tournament_teams (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.tournaments(event_id) on delete cascade,
  name            text not null check (char_length(btrim(name)) between 2 and 60),
  captain_id      uuid references public.profiles(id) on delete set null,
  status          public.team_status not null default 'pending',
  approved_at     timestamptz,
  fee_paid_at     timestamptz,
  hold_expires_at timestamptz,
  queued_at       timestamptz,
  canceled_at     timestamptz,
  cancel_reason   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, tournament_id)
);
create unique index tournament_teams_name_uniq on public.tournament_teams (tournament_id, lower(btrim(name)))
  where status not in ('canceled', 'rejected');
create index tournament_teams_status_idx  on public.tournament_teams (tournament_id, status);
create index tournament_teams_captain_idx on public.tournament_teams (captain_id);
create index tournament_teams_hold_idx    on public.tournament_teams (hold_expires_at) where hold_expires_at is not null;
create trigger tournament_teams_set_updated_at before update on public.tournament_teams
  for each row execute function private.set_updated_at();

create table public.tournament_team_members (
  team_id       uuid not null,
  tournament_id uuid not null,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  role          public.team_member_role not null default 'player',
  status        public.team_member_status not null default 'invited',
  invited_at    timestamptz not null default now(),
  responded_at  timestamptz,
  primary key (team_id, user_id),
  foreign key (team_id, tournament_id) references public.tournament_teams (id, tournament_id) on delete cascade
);

create unique index tournament_team_members_one_team on public.tournament_team_members (tournament_id, user_id)
  where status <> 'declined';
create index tournament_team_members_user_idx on public.tournament_team_members (user_id);

create table public.tournament_phase_teams (
  phase_id      uuid not null,
  tournament_id uuid not null,
  team_id       uuid not null,
  group_id      uuid,
  seed          smallint,
  primary key (phase_id, team_id),
  foreign key (phase_id, tournament_id) references public.tournament_phases (id, tournament_id) on delete cascade,
  foreign key (team_id, tournament_id)  references public.tournament_teams (id, tournament_id) on delete cascade,
  foreign key (group_id, phase_id)      references public.tournament_groups (id, phase_id) on delete set null (group_id)
);

create table public.tournament_matches (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null,
  phase_id       uuid not null,
  group_id       uuid,
  round          smallint not null check (round >= 1),
  position       smallint not null default 1 check (position >= 1),
  home_team_id   uuid,
  away_team_id   uuid,
  scheduled_at   timestamptz,
  venue_id       uuid references public.venues(id) on delete set null,
  court_id       uuid references public.courts(id) on delete set null,
  status         public.match_status not null default 'scheduled',
  home_score     smallint check (home_score >= 0),
  away_score     smallint check (away_score >= 0),
  winner_team_id uuid,
  score_detail   jsonb not null default '{}'::jsonb,
  next_match_id  uuid references public.tournament_matches(id) on delete set null,
  next_match_slot text check (next_match_slot in ('home', 'away')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (phase_id, tournament_id)        references public.tournament_phases (id, tournament_id) on delete cascade,
  foreign key (group_id, phase_id)             references public.tournament_groups (id, phase_id) on delete set null (group_id),
  foreign key (home_team_id, tournament_id)    references public.tournament_teams (id, tournament_id) on delete set null (home_team_id),
  foreign key (away_team_id, tournament_id)    references public.tournament_teams (id, tournament_id) on delete set null (away_team_id),
  foreign key (winner_team_id, tournament_id)  references public.tournament_teams (id, tournament_id) on delete set null (winner_team_id),
  constraint tournament_matches_teams_chk  check (home_team_id is null or away_team_id is null or home_team_id <> away_team_id),
  constraint tournament_matches_winner_chk check (winner_team_id is null or winner_team_id in (home_team_id, away_team_id)),
  constraint tournament_matches_result_chk check (
    status not in ('finished', 'walkover')
    or (home_team_id is not null and away_team_id is not null and home_score is not null and away_score is not null)),
  constraint tournament_matches_next_chk check ((next_match_id is null) = (next_match_slot is null))
);
create index tournament_matches_phase_idx on public.tournament_matches (phase_id, group_id, round, position);
create index tournament_matches_tournament_idx on public.tournament_matches (tournament_id, scheduled_at);
create index tournament_matches_home_idx on public.tournament_matches (home_team_id);
create index tournament_matches_away_idx on public.tournament_matches (away_team_id);
create index tournament_matches_next_idx on public.tournament_matches (next_match_id);
create index tournament_matches_venue_idx on public.tournament_matches (venue_id);
create index tournament_matches_court_idx on public.tournament_matches (court_id);
create trigger tournament_matches_set_updated_at before update on public.tournament_matches
  for each row execute function private.set_updated_at();

create function public.is_team_captain(p_team uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.tournament_teams where id = p_team and captain_id = auth.uid()) $$;

create function public.is_tournament_participant(p_tournament uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.tournament_team_members m
    where m.tournament_id = p_tournament and m.user_id = auth.uid() and m.status in ('invited', 'accepted'))
$$;

drop policy events_select on public.events;
create policy events_select on public.events for select to authenticated using (
  (visibility = 'public' and status <> 'draft' and not public.is_blocked_with(organizer_id))
  or organizer_id = auth.uid()
  or public.is_registered_in_event(id)
  or public.has_event_invite(id)
  or public.is_tournament_participant(id));

alter table public.tournaments enable row level security;
create policy tournaments_select on public.tournaments for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id));
create policy tournaments_insert on public.tournaments for insert to authenticated
  with check (public.is_event_organizer(event_id));
create policy tournaments_update on public.tournaments for update to authenticated
  using (public.is_event_organizer(event_id)) with check (public.is_event_organizer(event_id));

alter table public.tournament_phases enable row level security;
create policy tournament_phases_select on public.tournament_phases for select to authenticated
  using (exists (select 1 from public.events e where e.id = tournament_id));
create policy tournament_phases_write on public.tournament_phases for all to authenticated
  using (public.is_event_organizer(tournament_id)) with check (public.is_event_organizer(tournament_id));

alter table public.tournament_groups enable row level security;
create policy tournament_groups_select on public.tournament_groups for select to authenticated
  using (exists (select 1 from public.events e where e.id = tournament_id));
create policy tournament_groups_write on public.tournament_groups for all to authenticated
  using (public.is_event_organizer(tournament_id)) with check (public.is_event_organizer(tournament_id));

alter table public.tournament_teams enable row level security;
create policy tournament_teams_select on public.tournament_teams for select to authenticated
  using (exists (select 1 from public.events e where e.id = tournament_id));

alter table public.tournament_team_members enable row level security;
create policy tournament_team_members_select on public.tournament_team_members for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.events e where e.id = tournament_id));

alter table public.tournament_phase_teams enable row level security;
create policy tournament_phase_teams_select on public.tournament_phase_teams for select to authenticated
  using (exists (select 1 from public.events e where e.id = tournament_id));
create policy tournament_phase_teams_write on public.tournament_phase_teams for all to authenticated
  using (public.is_event_organizer(tournament_id)) with check (public.is_event_organizer(tournament_id));

alter table public.tournament_matches enable row level security;
create policy tournament_matches_select on public.tournament_matches for select to authenticated
  using (exists (select 1 from public.events e where e.id = tournament_id));
create policy tournament_matches_write on public.tournament_matches for all to authenticated
  using (public.is_event_organizer(tournament_id)) with check (public.is_event_organizer(tournament_id));

create function private.enforce_tournament_rules() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  e        public.events;
  v_plan   public.plans;
  v_system boolean := coalesce(current_setting('app.system', true), 'off') = 'on';
  v_teams  int;
begin
  select * into e from public.events where id = new.event_id;
  if not found or e.kind <> 'tournament' then
    raise exception 'not_a_tournament_event' using errcode = 'P0001';
  end if;

  if not v_system and e.organizer_id is not null then
    v_plan := private.user_plan(e.organizer_id);
    if tg_op = 'INSERT' and not private.has_permission(e.organizer_id, 'create_tournament') then
      raise exception 'plan_required' using errcode = 'P0001', detail = 'create_tournament';
    end if;
    if new.entry_fee_cents > 0 and (tg_op = 'INSERT' or old.entry_fee_cents is distinct from new.entry_fee_cents)
       and not private.has_permission(e.organizer_id, 'paid_events') then
      raise exception 'plan_required' using errcode = 'P0001', detail = 'paid_events';
    end if;
    if v_plan.max_teams_per_tournament is not null
       and (tg_op = 'INSERT' or old.max_teams is distinct from new.max_teams)
       and new.max_teams > v_plan.max_teams_per_tournament then
      raise exception 'plan_limit_exceeded' using errcode = 'P0001',
        detail = 'max_teams_per_tournament=' || v_plan.max_teams_per_tournament;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    select count(*) into v_teams from public.tournament_teams
     where tournament_id = new.event_id and status in ('pending', 'confirmed', 'waitlisted');
    if new.entry_fee_cents is distinct from old.entry_fee_cents and v_teams > 0 then
      raise exception 'fee_locked' using errcode = 'P0001', detail = 'Já há equipes inscritas.';
    end if;
    if new.max_teams < old.max_teams and new.max_teams < (
         select count(*) from public.tournament_teams where tournament_id = new.event_id and status = 'confirmed') then
      raise exception 'max_below_confirmed' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger tournaments_enforce_rules before insert or update on public.tournaments
  for each row execute function private.enforce_tournament_rules();

create function private.check_tournament_row() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.kind = 'tournament' and not exists (select 1 from public.tournaments where event_id = new.id) then
    raise exception 'tournament_details_missing' using errcode = 'P0001',
      detail = 'Crie a linha em tournaments na mesma transação do evento.';
  end if;
  return null;
end $$;
create constraint trigger events_tournament_row_chk after insert on public.events
  deferrable initially deferred for each row execute function private.check_tournament_row();

create function private.sync_tournament_capacity(p_event uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  e       public.events;
  t       public.tournaments;
  v_conf  int;
  v_wait  int;
  v_occ   int;
  v_next  uuid;
  v_prev  text := coalesce(current_setting('app.system', true), 'off');
begin
  select * into e from public.events where id = p_event for update;
  select * into t from public.tournaments where event_id = p_event;
  if e.id is null or t.event_id is null then return; end if;

  select count(*) filter (where status = 'confirmed'),
         count(*) filter (where status = 'waitlisted'),
         count(*) filter (where status = 'confirmed' or (status = 'pending' and (hold_expires_at is null or hold_expires_at > now())))
    into v_conf, v_wait, v_occ
    from public.tournament_teams where tournament_id = p_event;

  perform set_config('app.system', 'on', true);
  if v_conf <> e.confirmed_count or v_wait <> e.waitlist_count then
    update public.events set confirmed_count = v_conf, waitlist_count = v_wait where id = p_event;
  end if;

  if e.status in ('open', 'full') then
    if v_wait > 0 and v_occ < t.max_teams then
      select id into v_next from public.tournament_teams
       where tournament_id = p_event and status = 'waitlisted' order by queued_at, created_at limit 1;
      update public.tournament_teams set status = 'pending' where id = v_next;
    elsif e.status = 'open' and v_occ >= t.max_teams then
      update public.events set status = 'full' where id = p_event;
    elsif e.status = 'full' and v_occ < t.max_teams then
      update public.events set status = 'open' where id = p_event;
    end if;
  end if;
  perform set_config('app.system', v_prev, true);
end $$;

create function private.tournaments_after_update() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.max_teams is distinct from old.max_teams then
    perform private.sync_tournament_capacity(new.event_id);
  end if;
  return null;
end $$;
create trigger tournaments_after_update after update on public.tournaments
  for each row execute function private.tournaments_after_update();

create function private.enforce_team_rules() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  e         public.events;
  t         public.tournaments;
  v_system  boolean := coalesce(current_setting('app.system', true), 'off') = 'on';
  v_code_ok boolean := coalesce(current_setting('app.join_access', true), 'off') = 'on';
  v_promoting boolean;
  v_occ     int;
  v_invited boolean;
begin
  select * into e from public.events where id = new.tournament_id for update;
  select * into t from public.tournaments where event_id = new.tournament_id;
  if not found then raise exception 'tournament_not_found' using errcode = 'P0002'; end if;

  if tg_op = 'UPDATE' then
    if new.tournament_id <> old.tournament_id then raise exception 'immutable_team' using errcode = 'P0001'; end if;
    if old.status in ('canceled', 'rejected') and new.status not in ('canceled', 'rejected') then
      raise exception 'invalid_team_transition' using errcode = 'P0001';
    end if;
  end if;
  v_promoting := tg_op = 'UPDATE' and old.status = 'waitlisted' and new.status in ('pending', 'confirmed');

  if tg_op = 'INSERT' then
    if new.captain_id is null then raise exception 'captain_required' using errcode = 'P0001'; end if;
    if not v_system then
      if e.status not in ('open', 'full') then
        raise exception 'event_not_open' using errcode = 'P0001', detail = e.status::text;
      end if;
      if e.registration_deadline is not null and now() > e.registration_deadline
         and new.captain_id is distinct from e.organizer_id then
        raise exception 'registration_closed' using errcode = 'P0001';
      end if;
    end if;
    if not private.profile_ready_for_events(new.captain_id) then
      raise exception 'profile_incomplete' using errcode = 'P0001';
    end if;
    if private.is_blocked_between(new.captain_id, e.organizer_id) then
      raise exception 'blocked' using errcode = 'P0001';
    end if;
    if e.visibility = 'private' and new.captain_id is distinct from e.organizer_id and not v_system and not v_code_ok then
      v_invited := exists (select 1 from public.event_invites i
        where i.event_id = e.id and i.invited_user_id = new.captain_id
          and i.status in ('pending', 'accepted') and (i.expires_at is null or i.expires_at > now()));
      if not v_invited then raise exception 'event_private' using errcode = 'P0001'; end if;
    end if;
    if exists (select 1 from public.tournament_team_members m
                where m.tournament_id = new.tournament_id and m.user_id = new.captain_id and m.status <> 'declined') then
      raise exception 'already_in_tournament' using errcode = 'P0001';
    end if;
    new.status := 'pending';
  end if;

  if (tg_op = 'INSERT' or v_promoting) and new.status in ('pending', 'confirmed') then
    select count(*) into v_occ from public.tournament_teams
     where tournament_id = new.tournament_id and id <> new.id
       and (status = 'confirmed' or (status = 'pending' and (hold_expires_at is null or hold_expires_at > now())));
    if v_occ >= t.max_teams then
      if v_promoting then
        raise exception 'tournament_full' using errcode = 'P0001';
      elsif e.waitlist_enabled then
        new.status := 'waitlisted';
        new.queued_at := now();
      else
        raise exception 'tournament_full' using errcode = 'P0001';
      end if;
    end if;
  end if;

  if new.status in ('pending', 'confirmed') then
    if new.approved_at is null and not e.requires_approval then new.approved_at := now(); end if;
    if new.approved_at is not null and (t.entry_fee_cents = 0 or new.fee_paid_at is not null) then
      new.status := 'confirmed';
      new.hold_expires_at := null;
      new.queued_at := null;
    else
      new.status := 'pending';
      if new.approved_at is not null and t.entry_fee_cents > 0 and new.fee_paid_at is null
         and (new.hold_expires_at is null or v_promoting) then
        new.hold_expires_at := now() + make_interval(mins => private.setting_int('payment_hold_minutes', 15));
      end if;
    end if;
  end if;

  if new.status in ('canceled', 'rejected', 'waitlisted') and tg_op = 'UPDATE' and new.status <> old.status then
    new.hold_expires_at := null;
    if new.status = 'canceled' then
      if not v_system and e.status in ('in_progress', 'finished') then
        raise exception 'event_already_started' using errcode = 'P0001';
      end if;
      new.canceled_at := now();
    end if;
  end if;

  return new;
end $$;
create trigger tournament_teams_enforce_rules before insert or update on public.tournament_teams
  for each row execute function private.enforce_team_rules();

create function private.teams_after_write() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  e public.events;
  v_msg text;
begin
  if tg_op = 'DELETE' then
    perform private.sync_tournament_capacity(old.tournament_id);
    return null;
  end if;
  select * into e from public.events where id = new.tournament_id;

  if tg_op = 'INSERT' then
    insert into public.tournament_team_members (team_id, tournament_id, user_id, role, status, responded_at)
    values (new.id, new.tournament_id, new.captain_id, 'captain', 'accepted', now());
    perform private.notify(e.organizer_id, 'tournament_team_status', 'Nova equipe inscrita',
      'A equipe "' || new.name || '" se inscreveu em "' || e.title || '".', e.id,
      jsonb_build_object('team_id', new.id));
  elsif new.status is distinct from old.status then
    v_msg := case new.status
      when 'confirmed'  then 'Sua equipe "' || new.name || '" está confirmada em "' || e.title || '".'
      when 'pending'    then case when new.hold_expires_at is not null
                                  then 'Equipe "' || new.name || '" aprovada em "' || e.title || '". Pague a taxa para garantir a vaga.'
                                  else 'Equipe "' || new.name || '" aguardando aprovação em "' || e.title || '".' end
      when 'waitlisted' then 'Sua equipe "' || new.name || '" entrou na lista de espera de "' || e.title || '".'
      when 'rejected'   then 'Sua equipe "' || new.name || '" foi recusada em "' || e.title || '".'
      else null end;
    if v_msg is not null then
      perform private.notify(new.captain_id, 'tournament_team_status', 'Equipe: ' || new.status::text, v_msg, e.id,
        jsonb_build_object('team_id', new.id));
    end if;
    if new.status in ('canceled', 'rejected') then
      delete from public.tournament_team_members where team_id = new.id;
    end if;
  end if;

  perform private.sync_tournament_capacity(new.tournament_id);
  return null;
end $$;
create trigger tournament_teams_after_insert_update after insert or update of status on public.tournament_teams
  for each row execute function private.teams_after_write();
create trigger tournament_teams_after_delete after delete on public.tournament_teams
  for each row execute function private.teams_after_write();

create function private.enforce_team_member_rules() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  t         public.tournaments;
  v_captain uuid;
  v_n       int;
begin
  select * into t from public.tournaments where event_id = new.tournament_id;
  select captain_id into v_captain from public.tournament_teams where id = new.team_id;

  if tg_op = 'INSERT' then
    select count(*) into v_n from public.tournament_team_members
     where team_id = new.team_id and status in ('invited', 'accepted');
    if new.status <> 'declined' and v_n >= t.players_per_team_max then
      raise exception 'team_full' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.tournament_team_members
                where tournament_id = new.tournament_id and user_id = new.user_id and status <> 'declined') then
      raise exception 'already_in_tournament' using errcode = 'P0001';
    end if;
    if new.role = 'player' and private.is_blocked_between(new.user_id, v_captain) then
      raise exception 'blocked' using errcode = 'P0001';
    end if;
  end if;

  if new.status = 'accepted' and not private.profile_ready_for_events(new.user_id) then
    raise exception 'profile_incomplete' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger tournament_team_members_enforce_rules before insert or update on public.tournament_team_members
  for each row execute function private.enforce_team_member_rules();

create function private.team_members_after_write() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  t public.tournament_teams;
  e public.events;
begin
  if tg_op = 'INSERT' and new.status = 'invited' then
    select * into t from public.tournament_teams where id = new.team_id;
    select * into e from public.events where id = new.tournament_id;
    perform private.notify(new.user_id, 'tournament_team_invite', 'Convite para equipe',
      'Você foi convidado para a equipe "' || t.name || '" em "' || e.title || '".', e.id,
      jsonb_build_object('team_id', t.id));
  end if;
  return null;
end $$;
create trigger tournament_team_members_after_insert after insert on public.tournament_team_members
  for each row execute function private.team_members_after_write();

create function public.register_tournament_team(
  p_event_id uuid, p_name text, p_invite_code text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  e     public.events;
  t     public.tournament_teams;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not private.has_permission(v_uid, 'join_events') then
    raise exception 'plan_required' using errcode = 'P0001', detail = 'join_events';
  end if;
  select * into e from public.events where id = p_event_id and kind = 'tournament';
  if not found or (e.status = 'draft' and e.organizer_id is distinct from v_uid) then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;

  if e.visibility = 'private' and e.organizer_id is distinct from v_uid
     and not exists (select 1 from public.event_invites i where i.event_id = e.id and i.invited_user_id = v_uid
                       and i.status in ('pending', 'accepted') and (i.expires_at is null or i.expires_at > now())) then
    if p_invite_code is null or lower(p_invite_code) <> lower(coalesce(e.invite_code, '')) then
      raise exception 'event_not_found' using errcode = 'P0002';
    end if;
    perform set_config('app.join_access', 'on', true);
  end if;

  insert into public.tournament_teams (tournament_id, name, captain_id)
  values (p_event_id, btrim(p_name), v_uid) returning * into t;
  select * into t from public.tournament_teams where id = t.id;

  return jsonb_build_object('team_id', t.id, 'status', t.status, 'hold_expires_at', t.hold_expires_at);
end $$;

create function public.invite_team_member(p_team_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  t public.tournament_teams;
begin
  select * into t from public.tournament_teams where id = p_team_id;
  if not found or t.captain_id is distinct from auth.uid() or t.status in ('canceled', 'rejected') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  insert into public.tournament_team_members (team_id, tournament_id, user_id, role, status)
  values (p_team_id, t.tournament_id, p_user_id, 'player', 'invited')
  on conflict (team_id, user_id) do update set status = 'invited', invited_at = now(), responded_at = null
    where public.tournament_team_members.status = 'declined';
end $$;

create function public.respond_team_invite(p_team_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.tournament_team_members
     set status = case when p_accept then 'accepted'::public.team_member_status else 'declined'::public.team_member_status end,
         responded_at = now()
   where team_id = p_team_id and user_id = auth.uid() and status = 'invited';
  if not found then raise exception 'invite_not_found' using errcode = 'P0002'; end if;
end $$;

create function public.remove_team_member(p_team_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  t public.tournament_teams;
begin
  select * into t from public.tournament_teams where id = p_team_id;
  if not found then raise exception 'team_not_found' using errcode = 'P0002'; end if;
  if p_user_id = t.captain_id then raise exception 'captain_cannot_leave' using errcode = 'P0001'; end if;
  if auth.uid() is distinct from p_user_id and auth.uid() is distinct from t.captain_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.tournament_team_members where team_id = p_team_id and user_id = p_user_id;
end $$;

create function public.cancel_team(p_team_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.tournament_teams set status = 'canceled', cancel_reason = 'captain_request'
   where id = p_team_id and captain_id = auth.uid() and status in ('pending', 'confirmed', 'waitlisted');
  if not found then raise exception 'team_not_found' using errcode = 'P0002'; end if;
end $$;

create function public.decide_team(p_team_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  t public.tournament_teams;
begin
  select * into t from public.tournament_teams where id = p_team_id;
  if not found or not private.is_event_organizer(t.tournament_id, auth.uid()) then
    raise exception 'team_not_found' using errcode = 'P0002';
  end if;
  if t.status not in ('pending', 'waitlisted') then raise exception 'invalid_team_transition' using errcode = 'P0001'; end if;
  if p_approve then
    update public.tournament_teams set approved_at = now() where id = p_team_id;
  else
    update public.tournament_teams set status = 'rejected' where id = p_team_id;
  end if;
end $$;

create function private.matches_before_write() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_format public.phase_format;
  v_system boolean := coalesce(current_setting('app.system', true), 'off') = 'on';
begin
  select format into v_format from public.tournament_phases where id = new.phase_id;
  if v_format = 'group_stage' and new.group_id is null then
    raise exception 'group_required' using errcode = 'P0001';
  end if;

  if not v_system and (tg_op = 'INSERT' or new.home_team_id is distinct from old.home_team_id
                       or new.away_team_id is distinct from old.away_team_id) then
    if exists (select 1 from public.tournament_teams
                where id in (new.home_team_id, new.away_team_id) and status <> 'confirmed') then
      raise exception 'team_not_confirmed' using errcode = 'P0001';
    end if;
  end if;

  if new.status in ('finished', 'walkover') then
    if new.home_score > new.away_score then new.winner_team_id := new.home_team_id;
    elsif new.home_score < new.away_score then new.winner_team_id := new.away_team_id;
    elsif v_format = 'knockout' then
      if new.winner_team_id is null then
        raise exception 'winner_required' using errcode = 'P0001', detail = 'Empate no mata-mata: informe o vencedor.';
      end if;
    else
      new.winner_team_id := null;
    end if;
  elsif tg_op = 'INSERT' or new.status is distinct from old.status then
    new.winner_team_id := null;
  end if;
  return new;
end $$;
create trigger tournament_matches_before_write before insert or update on public.tournament_matches
  for each row execute function private.matches_before_write();

create function private.matches_after_update() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  e   public.events;
  u   uuid;
  v_prev text := coalesce(current_setting('app.system', true), 'off');
begin

  if new.status in ('finished', 'walkover') and new.winner_team_id is not null and new.next_match_id is not null
     and (old.status not in ('finished', 'walkover') or old.winner_team_id is distinct from new.winner_team_id) then
    perform set_config('app.system', 'on', true);
    if new.next_match_slot = 'home' then
      update public.tournament_matches set home_team_id = new.winner_team_id where id = new.next_match_id;
    else
      update public.tournament_matches set away_team_id = new.winner_team_id where id = new.next_match_id;
    end if;
    perform set_config('app.system', v_prev, true);
  end if;

  if new.scheduled_at is not null and new.scheduled_at is distinct from old.scheduled_at
     and new.status = 'scheduled' then
    select * into e from public.events where id = new.tournament_id;
    for u in
      select distinct m.user_id from public.tournament_team_members m
       where m.team_id in (new.home_team_id, new.away_team_id) and m.status = 'accepted'
    loop
      perform private.notify(u, 'tournament_match', 'Partida marcada',
        'Sua partida em "' || e.title || '" foi marcada para ' ||
        to_char(new.scheduled_at at time zone private.setting_text('timezone', 'America/Sao_Paulo'), 'DD/MM HH24:MI') || '.',
        e.id, jsonb_build_object('match_id', new.id));
    end loop;
  end if;
  return null;
end $$;
create trigger tournament_matches_after_update after update on public.tournament_matches
  for each row execute function private.matches_after_update();

create view public.tournament_standings with (security_invoker = true) as
with results as (
  select m.phase_id, m.home_team_id as team_id, m.home_score as gf, m.away_score as ga
    from public.tournament_matches m
   where m.status in ('finished', 'walkover') and m.home_team_id is not null and m.away_team_id is not null
  union all
  select m.phase_id, m.away_team_id, m.away_score, m.home_score
    from public.tournament_matches m
   where m.status in ('finished', 'walkover') and m.home_team_id is not null and m.away_team_id is not null
),
agg as (
  select r.phase_id, r.team_id,
         count(*)                              as played,
         count(*) filter (where r.gf > r.ga)  as wins,
         count(*) filter (where r.gf = r.ga)  as draws,
         count(*) filter (where r.gf < r.ga)  as losses,
         sum(r.gf)                             as goals_for,
         sum(r.ga)                             as goals_against,
         sum(case when r.gf > r.ga then p.points_win when r.gf = r.ga then p.points_draw else p.points_loss end) as points
  from results r
  join public.tournament_phases p on p.id = r.phase_id
  group by r.phase_id, r.team_id
),
table_rows as (
  select pt.tournament_id, pt.phase_id, pt.group_id, pt.team_id, t.name as team_name,
         coalesce(a.played, 0)        as played,
         coalesce(a.wins, 0)          as wins,
         coalesce(a.draws, 0)         as draws,
         coalesce(a.losses, 0)        as losses,
         coalesce(a.goals_for, 0)     as goals_for,
         coalesce(a.goals_against, 0) as goals_against,
         coalesce(a.goals_for, 0) - coalesce(a.goals_against, 0) as goal_diff,
         coalesce(a.points, 0)        as points
  from public.tournament_phase_teams pt
  join public.tournament_phases ph on ph.id = pt.phase_id and ph.format <> 'knockout'
  join public.tournament_teams t on t.id = pt.team_id
  left join agg a on a.phase_id = pt.phase_id and a.team_id = pt.team_id
)
select tr.*,
       rank() over (partition by tr.phase_id, tr.group_id
                    order by tr.points desc, tr.goal_diff desc, tr.goals_for desc) as position
from table_rows tr;
