set search_path = public, extensions;

create type public.conversation_type as enum ('direct', 'group', 'event');
create type public.conversation_role as enum ('admin', 'member');

create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  type            public.conversation_type not null,
  title           text check (char_length(btrim(title)) between 1 and 80),
  event_id        uuid unique references public.events(id) on delete cascade,
  direct_key      text unique,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz,
  constraint conversations_shape_chk check (
       (type = 'event'  and event_id is not null and direct_key is null)
    or (type = 'direct' and direct_key is not null and event_id is null)
    or (type = 'group'  and title is not null and event_id is null and direct_key is null))
);
create index conversations_created_by_idx on public.conversations (created_by);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            public.conversation_role not null default 'member',
  joined_at       timestamptz not null default now(),
  left_at         timestamptz,
  last_read_at    timestamptz,
  muted           boolean not null default false,
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id) where left_at is null;

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid references public.profiles(id) on delete set null,
  body            text not null check (char_length(btrim(body)) between 1 and 4000),
  reply_to_id     uuid references public.messages(id) on delete set null,
  created_at      timestamptz not null default now(),
  edited_at       timestamptz,
  deleted_at      timestamptz
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index messages_sender_idx       on public.messages (sender_id);
create index messages_reply_idx        on public.messages (reply_to_id);

create function public.is_conversation_member(p_conv uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.conversation_members
                  where conversation_id = p_conv and user_id = auth.uid() and left_at is null)
$$;

create function public.can_send_message(p_conv uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select public.is_conversation_member(p_conv)
     and not exists (
       select 1
         from public.conversations c
         join public.conversation_members m on m.conversation_id = c.id and m.user_id <> auth.uid()
        where c.id = p_conv and c.type = 'direct' and private.is_blocked_between(auth.uid(), m.user_id))
$$;

alter table public.conversations enable row level security;
create policy conversations_select on public.conversations for select to authenticated
  using (public.is_conversation_member(id));

alter table public.conversation_members enable row level security;
create policy conversation_members_select on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id));
create policy conversation_members_update_own on public.conversation_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.messages enable row level security;
create policy messages_select on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.can_send_message(conversation_id));
create policy messages_update_own on public.messages for update to authenticated
  using (sender_id = auth.uid() and deleted_at is null) with check (sender_id = auth.uid());

create function private.messages_after_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_members set last_read_at = new.created_at
   where conversation_id = new.conversation_id and user_id = new.sender_id;
  return null;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function private.messages_after_insert();

create function private.messages_before_update() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin

  if new.conversation_id <> old.conversation_id
     or (new.sender_id is distinct from old.sender_id and new.sender_id is not null) then
    raise exception 'immutable_message' using errcode = 'P0001';
  end if;
  if new.body is distinct from old.body and new.deleted_at is null then new.edited_at := now(); end if;
  return new;
end $$;
create trigger messages_before_update before update on public.messages
  for each row execute function private.messages_before_update();

create function private.add_conversation_member(p_event uuid, p_user uuid, p_role public.conversation_role default 'member')
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_conv uuid;
begin
  select id into v_conv from public.conversations where event_id = p_event;
  if v_conv is null or p_user is null then return; end if;
  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_conv, p_user, p_role)
  on conflict (conversation_id, user_id) do update
    set left_at = null, joined_at = case when public.conversation_members.left_at is not null then now()
                                         else public.conversation_members.joined_at end;
end $$;

create function private.remove_conversation_member(p_event uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.conversation_members m set left_at = now()
   where m.user_id = p_user and m.left_at is null
     and m.conversation_id = (select id from public.conversations where event_id = p_event)
     and m.role <> 'admin';
end $$;

create function private.events_create_conversation() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_conv uuid;
begin
  insert into public.conversations (type, title, event_id, created_by)
  values ('event', left(new.title, 80), new.id, new.organizer_id) returning id into v_conv;
  if new.organizer_id is not null then
    insert into public.conversation_members (conversation_id, user_id, role)
    values (v_conv, new.organizer_id, 'admin');
  end if;
  return null;
end $$;
create trigger events_create_conversation after insert on public.events
  for each row execute function private.events_create_conversation();

create function private.events_sync_conversation_title() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.conversations set title = left(new.title, 80) where event_id = new.id;
  return null;
end $$;
create trigger events_sync_conversation_title after update of title on public.events
  for each row execute function private.events_sync_conversation_title();

create function private.registrations_sync_conversation() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform private.remove_conversation_member(old.event_id, old.user_id);
  elsif new.status = 'confirmed' then
    perform private.add_conversation_member(new.event_id, new.user_id);
  else
    perform private.remove_conversation_member(new.event_id, new.user_id);
  end if;
  return null;
end $$;
create trigger event_registrations_sync_conversation after insert or update of status or delete on public.event_registrations
  for each row execute function private.registrations_sync_conversation();

create function private.team_members_sync_conversation() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform private.remove_conversation_member(old.tournament_id, old.user_id);
  elsif new.status = 'accepted' then
    perform private.add_conversation_member(new.tournament_id, new.user_id);
  else
    perform private.remove_conversation_member(new.tournament_id, new.user_id);
  end if;
  return null;
end $$;
create trigger tournament_team_members_sync_conversation after insert or update of status or delete on public.tournament_team_members
  for each row execute function private.team_members_sync_conversation();

create function public.start_direct_conversation(p_user_id uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_key  text;
  v_conv uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not private.has_permission(v_uid, 'chat') then
    raise exception 'plan_required' using errcode = 'P0001', detail = 'chat';
  end if;
  if p_user_id = v_uid then raise exception 'invalid_recipient' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if private.is_blocked_between(v_uid, p_user_id) then raise exception 'blocked' using errcode = 'P0001'; end if;

  v_key := least(v_uid::text, p_user_id::text) || ':' || greatest(v_uid::text, p_user_id::text);
  select id into v_conv from public.conversations where direct_key = v_key;
  if v_conv is null then
    insert into public.conversations (type, direct_key, created_by) values ('direct', v_key, v_uid) returning id into v_conv;
  end if;
  insert into public.conversation_members (conversation_id, user_id) values (v_conv, v_uid), (v_conv, p_user_id)
  on conflict (conversation_id, user_id) do update set left_at = null;
  return v_conv;
end $$;

create function public.create_group_conversation(p_title text, p_user_ids uuid[]) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_conv uuid;
  v_ids  uuid[];
  v_max  int := private.setting_int('max_group_members', 50);
  u      uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not private.has_permission(v_uid, 'chat') then
    raise exception 'plan_required' using errcode = 'P0001', detail = 'chat';
  end if;
  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(p_user_ids) x where x <> v_uid;
  if cardinality(v_ids) + 1 > v_max then raise exception 'group_too_large' using errcode = 'P0001'; end if;
  if cardinality(v_ids) < 1 then raise exception 'group_needs_members' using errcode = 'P0001'; end if;
  foreach u in array v_ids loop
    if not exists (select 1 from public.profiles where id = u) then
      raise exception 'user_not_found' using errcode = 'P0002';
    end if;
    if private.is_blocked_between(v_uid, u) then raise exception 'blocked' using errcode = 'P0001'; end if;
  end loop;

  insert into public.conversations (type, title, created_by) values ('group', btrim(p_title), v_uid) returning id into v_conv;
  insert into public.conversation_members (conversation_id, user_id, role) values (v_conv, v_uid, 'admin');
  insert into public.conversation_members (conversation_id, user_id) select v_conv, x from unnest(v_ids) x;
  return v_conv;
end $$;

create function public.add_group_member(p_conversation_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_n   int;
begin
  if not exists (select 1 from public.conversations c
                  join public.conversation_members m on m.conversation_id = c.id
                 where c.id = p_conversation_id and c.type = 'group'
                   and m.user_id = v_uid and m.role = 'admin' and m.left_at is null) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if private.is_blocked_between(v_uid, p_user_id) then raise exception 'blocked' using errcode = 'P0001'; end if;
  select count(*) into v_n from public.conversation_members where conversation_id = p_conversation_id and left_at is null;
  if v_n >= private.setting_int('max_group_members', 50) then raise exception 'group_too_large' using errcode = 'P0001'; end if;
  insert into public.conversation_members (conversation_id, user_id) values (p_conversation_id, p_user_id)
  on conflict (conversation_id, user_id) do update set left_at = null, joined_at = now();
end $$;

create function public.leave_conversation(p_conversation_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.conversations where id = p_conversation_id and type = 'event') then
    raise exception 'cannot_leave_event_chat' using errcode = 'P0001';
  end if;
  update public.conversation_members set left_at = now()
   where conversation_id = p_conversation_id and user_id = auth.uid() and left_at is null;
  if not found then raise exception 'not_a_member' using errcode = 'P0002'; end if;
end $$;

create function public.mark_conversation_read(p_conversation_id uuid) returns void
language sql security definer set search_path = public, pg_temp
as $$
  update public.conversation_members set last_read_at = now()
   where conversation_id = p_conversation_id and user_id = auth.uid() and left_at is null
$$;

create function public.delete_message(p_message_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.messages m
     set deleted_at = now(), body = '[mensagem removida]'
   where m.id = p_message_id and m.deleted_at is null
     and (m.sender_id = auth.uid()
          or exists (select 1 from public.conversation_members cm
                      where cm.conversation_id = m.conversation_id and cm.user_id = auth.uid()
                        and cm.role = 'admin' and cm.left_at is null));
  if not found then raise exception 'message_not_found' using errcode = 'P0002'; end if;
end $$;
