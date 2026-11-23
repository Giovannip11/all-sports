set search_path = public, extensions;

create type public.notification_type as enum (
  'event_updated', 'event_canceled', 'event_full',
  'registration_confirmed', 'waitlist_promoted', 'registration_expired',
  'event_invite', 'join_request', 'join_request_decided',
  'follow_request', 'new_follower', 'follow_accepted',
  'tournament_team_status', 'tournament_team_invite', 'tournament_match',
  'payment_paid', 'payment_failed',
  'subscription_changed', 'review_received', 'system'
);

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  type         public.notification_type not null,
  title        text,
  message      text not null,
  data         jsonb not null default '{}'::jsonb,
  event_id     uuid,
  in_app       boolean not null default true,
  push_pending boolean not null default false,
  push_sent_at timestamptz,
  push_error   text,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index notifications_user_idx   on public.notifications (user_id, created_at desc) where in_app;
create index notifications_unread_idx on public.notifications (user_id) where in_app and read_at is null;
create index notifications_push_idx   on public.notifications (created_at) where push_pending and push_sent_at is null;

alter table public.notifications enable row level security;
create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = auth.uid() and in_app);
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete_own on public.notifications for delete to authenticated
  using (user_id = auth.uid());

create table public.notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  type    public.notification_type not null,
  in_app  boolean not null default true,
  push    boolean not null default true,
  primary key (user_id, type)
);
alter table public.notification_preferences enable row level security;
create policy notification_preferences_own on public.notification_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create type public.device_platform as enum ('ios', 'android', 'web');
create table public.push_devices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  token        text not null unique,
  platform     public.device_platform not null,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_devices_user_idx on public.push_devices (user_id);
alter table public.push_devices enable row level security;
create policy push_devices_own on public.push_devices for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create function private.notify(
  p_user uuid, p_type public.notification_type, p_title text, p_message text,
  p_event uuid default null, p_data jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_in_app boolean;
  v_push   boolean;
begin
  if p_user is null then return; end if;
  select in_app, push into v_in_app, v_push
    from public.notification_preferences where user_id = p_user and type = p_type;
  if not found then v_in_app := true; v_push := true; end if;
  if not v_in_app and not v_push then return; end if;

  insert into public.notifications (user_id, type, title, message, event_id, data, in_app, push_pending)
  values (p_user, p_type, p_title, p_message, p_event, coalesce(p_data, '{}'::jsonb), v_in_app, v_push);
end $$;

create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;
create policy user_blocks_select_own on public.user_blocks for select to authenticated using (blocker_id = auth.uid());
create policy user_blocks_insert_own on public.user_blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy user_blocks_delete_own on public.user_blocks for delete to authenticated using (blocker_id = auth.uid());

create function private.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select a is not null and b is not null and exists (
    select 1 from public.user_blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

create function public.is_blocked_with(p_other uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select private.is_blocked_between(auth.uid(), p_other) $$;

create type public.follow_status as enum ('pending', 'accepted');

create table public.follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  followee_id  uuid not null references public.profiles(id) on delete cascade,
  status       public.follow_status not null default 'accepted',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id, status);

alter table public.follows enable row level security;
create policy follows_select_mine on public.follows for select to authenticated
  using (follower_id = auth.uid() or followee_id = auth.uid());
create policy follows_insert_own on public.follows for insert to authenticated
  with check (follower_id = auth.uid());
create policy follows_update_followee on public.follows for update to authenticated
  using (followee_id = auth.uid()) with check (followee_id = auth.uid());
create policy follows_delete_either on public.follows for delete to authenticated
  using (follower_id = auth.uid() or followee_id = auth.uid());

create function private.follows_before_write() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_visibility public.profile_visibility;
begin
  if tg_op = 'INSERT' then
    if private.is_blocked_between(new.follower_id, new.followee_id) then
      raise exception 'blocked' using errcode = 'P0001';
    end if;
    select profile_visibility into v_visibility from public.profiles where id = new.followee_id;
    if not found then raise exception 'user_not_found' using errcode = 'P0002'; end if;
    new.status := case when v_visibility = 'public' then 'accepted' else 'pending' end;
    new.responded_at := case when new.status = 'accepted' then now() end;
  else

    if new.follower_id <> old.follower_id or new.followee_id <> old.followee_id
       or old.status <> 'pending' or new.status <> 'accepted' then
      raise exception 'invalid_follow_update' using errcode = 'P0001';
    end if;
    new.responded_at := now();
  end if;
  return new;
end $$;

create trigger follows_before_write before insert or update on public.follows
  for each row execute function private.follows_before_write();

create function private.follows_after_write() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_follower text;
  v_followee text;
begin
  select name into v_follower from public.profiles where id = new.follower_id;
  select name into v_followee from public.profiles where id = new.followee_id;
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      perform private.notify(new.followee_id, 'follow_request', 'Pedido para seguir',
        v_follower || ' quer seguir você.', null, jsonb_build_object('user_id', new.follower_id));
    else
      perform private.notify(new.followee_id, 'new_follower', 'Novo seguidor',
        v_follower || ' começou a seguir você.', null, jsonb_build_object('user_id', new.follower_id));
    end if;
  elsif old.status = 'pending' and new.status = 'accepted' then
    perform private.notify(new.follower_id, 'follow_accepted', 'Pedido aceito',
      v_followee || ' aceitou seu pedido para seguir.', null, jsonb_build_object('user_id', new.followee_id));
  end if;
  return null;
end $$;

create trigger follows_after_write after insert or update on public.follows
  for each row execute function private.follows_after_write();

create function private.blocks_cleanup() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  delete from public.follows
   where (follower_id = new.blocker_id and followee_id = new.blocked_id)
      or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  return null;
end $$;
create trigger user_blocks_cleanup after insert on public.user_blocks
  for each row execute function private.blocks_cleanup();

create function private.profile_visibility_changed() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.profile_visibility = 'public' and old.profile_visibility = 'private' then
    update public.follows set status = 'accepted' where followee_id = new.id and status = 'pending';
  end if;
  return null;
end $$;
create trigger profiles_visibility_changed after update of profile_visibility on public.profiles
  for each row execute function private.profile_visibility_changed();

create view public.friendships with (security_invoker = true) as
select a.follower_id as user_id, a.followee_id as friend_id
from public.follows a
join public.follows b
  on b.follower_id = a.followee_id and b.followee_id = a.follower_id
where a.status = 'accepted' and b.status = 'accepted';

create view public.public_profiles as
select
  p.id,
  p.name,
  p.avatar_url,
  p.profile_visibility,
  case when p.profile_visibility = 'public' or p.id = auth.uid() or fm.status = 'accepted'
       then p.bio end                                                              as bio,
  fm.status                                                                        as my_follow_status,
  (select count(*) from public.follows f where f.followee_id = p.id and f.status = 'accepted') as followers_count,
  (select count(*) from public.follows f where f.follower_id = p.id and f.status = 'accepted') as following_count
from public.profiles p
left join public.follows fm on fm.follower_id = auth.uid() and fm.followee_id = p.id
where auth.uid() is not null
  and not public.is_blocked_with(p.id);

create type public.report_target as enum ('user', 'message', 'event', 'review');
create type public.report_reason as enum ('spam', 'harassment', 'inappropriate_content', 'fraud', 'safety', 'other');
create type public.report_status as enum ('open', 'in_review', 'resolved', 'dismissed');

create table public.reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid references public.profiles(id) on delete set null,
  target_type     public.report_target not null,
  target_id       uuid not null,
  target_user_id  uuid references public.profiles(id) on delete set null,
  reason          public.report_reason not null,
  details         text check (char_length(details) <= 1000),
  status          public.report_status not null default 'open',
  handled_by      uuid references public.profiles(id) on delete set null,
  handled_at      timestamptz,
  resolution_note text,
  created_at      timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at);
create index reports_target_idx on public.reports (target_type, target_id);

create unique index reports_one_open_per_reporter
  on public.reports (reporter_id, target_type, target_id) where status in ('open', 'in_review');

alter table public.reports enable row level security;
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_platform_admin());
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());
create policy reports_update_admin on public.reports for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create function private.reports_before_update() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.status in ('resolved', 'dismissed') and old.status not in ('resolved', 'dismissed') then
    new.handled_at := now();
    new.handled_by := coalesce(new.handled_by, auth.uid());
  end if;
  return new;
end $$;
create trigger reports_before_update before update on public.reports
  for each row execute function private.reports_before_update();
