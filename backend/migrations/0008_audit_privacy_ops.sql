set search_path = public, extensions;

create table public.audit_logs (
  id              bigint generated always as identity primary key,
  occurred_at     timestamptz not null default now(),
  actor_id        uuid,
  actor_role      text,
  action          text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_name      text not null,
  record_id       text,
  old_data        jsonb,
  new_data        jsonb,
  changed_cols    text[],
  retention_until timestamptz
);
create index audit_logs_actor_idx     on public.audit_logs (actor_id, occurred_at desc);
create index audit_logs_record_idx    on public.audit_logs (table_name, record_id, occurred_at desc);
create index audit_logs_retention_idx on public.audit_logs (retention_until) where retention_until is not null;

alter table public.audit_logs enable row level security;
create policy audit_logs_select_admin on public.audit_logs for select to authenticated
  using (public.is_platform_admin());

create function private.audit_logs_immutable() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('app.audit_maintenance', true), 'off') = 'on' then
    return case tg_op when 'DELETE' then old else new end;
  end if;
  raise exception 'audit_logs_are_immutable' using errcode = 'P0001';
end $$;
create trigger audit_logs_no_update_delete before update or delete on public.audit_logs
  for each row execute function private.audit_logs_immutable();

create function private.audit_trigger() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_old     jsonb;
  v_new     jsonb;
  v_changed text[];
  v_ignore  text[] := coalesce(tg_argv, '{}'::text[]);
  v_row     jsonb;
begin
  if coalesce(current_setting('app.skip_audit', true), 'off') = 'on' then return null; end if;

  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_row := v_new;
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_row := v_old;
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    select array_agg(n.key order by n.key) into v_changed
      from jsonb_each(v_new) n
     where n.key <> all (v_ignore) and n.value is distinct from v_old -> n.key;
    if v_changed is null then return null; end if;
    select jsonb_object_agg(k, v_old -> k) into v_old from unnest(v_changed) k;
    select jsonb_object_agg(k, v_new -> k) into v_new from unnest(v_changed) k;
    v_row := to_jsonb(new);
  end if;

  insert into public.audit_logs (actor_id, actor_role, action, table_name, record_id, old_data, new_data, changed_cols)
  values (auth.uid(), nullif(current_setting('request.jwt.claim.role', true), ''), tg_op, tg_table_name,
          coalesce(v_row ->> 'id', v_row ->> 'event_id', v_row ->> 'code', v_row ->> 'key', v_row ->> 'user_id'),
          v_old, v_new, v_changed);
  return null;
end $$;

create trigger events_audit after insert or update or delete on public.events
  for each row execute function private.audit_trigger('updated_at', 'confirmed_count', 'waitlist_count');
create trigger event_registrations_audit after update or delete on public.event_registrations
  for each row execute function private.audit_trigger('updated_at', 'queued_at', 'confirmed_at', 'hold_expires_at',
                                                      'presence_confirmed_at', 'checked_in_at', 'checked_in_by');
create trigger plans_audit after insert or update or delete on public.plans
  for each row execute function private.audit_trigger('updated_at');
create trigger permissions_audit after insert or update or delete on public.permissions
  for each row execute function private.audit_trigger();
create trigger subscriptions_audit after insert or update or delete on public.subscriptions
  for each row execute function private.audit_trigger('updated_at');
create trigger payments_audit after insert or update or delete on public.payments
  for each row execute function private.audit_trigger('updated_at');
create trigger payment_refunds_audit after insert on public.payment_refunds
  for each row execute function private.audit_trigger();
create trigger venues_audit after insert or update or delete on public.venues
  for each row execute function private.audit_trigger('updated_at');
create trigger courts_audit after insert or update or delete on public.courts
  for each row execute function private.audit_trigger('updated_at');
create trigger tournaments_audit after insert or update or delete on public.tournaments
  for each row execute function private.audit_trigger('updated_at');
create trigger tournament_teams_audit after insert or update or delete on public.tournament_teams
  for each row execute function private.audit_trigger('updated_at', 'queued_at', 'hold_expires_at');
create trigger tournament_matches_audit after insert or update or delete on public.tournament_matches
  for each row execute function private.audit_trigger('updated_at');
create trigger reports_audit after insert or update or delete on public.reports
  for each row execute function private.audit_trigger();
create trigger platform_admins_audit after insert or update or delete on public.platform_admins
  for each row execute function private.audit_trigger();
create trigger app_settings_audit after insert or update or delete on public.app_settings
  for each row execute function private.audit_trigger('updated_at');

create function private.prepare_account_deletion() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_until      timestamptz := now() + make_interval(months => private.setting_int('data_retention_months', 24));
  v_prev_sys   text := coalesce(current_setting('app.system', true), 'off');
  v_prev_audit text := coalesce(current_setting('app.audit_maintenance', true), 'off');
begin
  perform set_config('app.system', 'on', true);

  update public.events set status = 'canceled', cancel_reason = 'organizer_account_deleted'
   where organizer_id = old.id and status in ('open', 'full') and starts_at > now();
  delete from public.events where organizer_id = old.id and status = 'draft';

  perform set_config('app.audit_maintenance', 'on', true);

  update public.audit_logs set retention_until = v_until
   where table_name in ('payments', 'payment_refunds')
     and record_id in (select id::text from public.payments where user_id = old.id
                       union select r.id::text from public.payment_refunds r join public.payments p on p.id = r.payment_id
                              where p.user_id = old.id);
  update public.payments
     set retention_until = v_until, anonymized_at = now(),
         card_brand = null, card_last4 = null, gateway_customer_id = null, metadata = '{}'::jsonb
   where user_id = old.id;

  update public.audit_logs set retention_until = v_until, actor_id = null where actor_id = old.id;

  insert into public.audit_logs (actor_id, actor_role, action, table_name, record_id, new_data, retention_until)
  values (null, nullif(current_setting('request.jwt.claim.role', true), ''), 'DELETE', 'profiles', old.id::text,
          jsonb_build_object('reason', 'account_deletion'), v_until);

  perform set_config('app.audit_maintenance', v_prev_audit, true);
  perform set_config('app.system', v_prev_sys, true);
  return old;
end $$;
create trigger profiles_prepare_deletion before delete on public.profiles
  for each row execute function private.prepare_account_deletion();

create function private.purge_expired_data() returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_payments int;
  v_audit    int;
begin
  perform set_config('app.skip_audit', 'on', true);
  delete from public.payments where retention_until is not null and retention_until < now();
  get diagnostics v_payments = row_count;
  perform set_config('app.skip_audit', 'off', true);

  perform set_config('app.audit_maintenance', 'on', true);
  delete from public.audit_logs where retention_until is not null and retention_until < now();
  get diagnostics v_audit = row_count;
  perform set_config('app.audit_maintenance', 'off', true);

  return jsonb_build_object('payments_deleted', v_payments, 'audit_logs_deleted', v_audit);
end $$;

create function private.tick() returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_finished  int;
  v_started   int;
  v_holds     int;
  v_team_holds int;
  v_invites   int;
  v_subs      int := 0;
  s           record;
begin
  perform set_config('app.system', 'on', true);

  update public.events set status = 'finished'
   where status in ('open', 'full', 'in_progress') and ends_at <= now();
  get diagnostics v_finished = row_count;
  update public.events set status = 'in_progress'
   where status in ('open', 'full') and starts_at <= now() and ends_at > now();
  get diagnostics v_started = row_count;

  update public.event_registrations set status = 'canceled', cancel_reason = 'payment_timeout'
   where status = 'confirmed' and hold_expires_at is not null and hold_expires_at <= now();
  get diagnostics v_holds = row_count;
  update public.tournament_teams set status = 'canceled', cancel_reason = 'payment_timeout'
   where status = 'pending' and hold_expires_at is not null and hold_expires_at <= now();
  get diagnostics v_team_holds = row_count;

  update public.event_invites set status = 'expired'
   where status = 'pending' and expires_at is not null and expires_at <= now();
  get diagnostics v_invites = row_count;

  for s in
    update public.subscriptions
       set status = case when cancel_at_period_end then 'canceled'::public.subscription_status
                         else 'expired'::public.subscription_status end,
           canceled_at = case when cancel_at_period_end then now() else canceled_at end,
           ended_at = now()
     where status in ('trialing', 'active', 'past_due')
       and current_period_end is not null and current_period_end <= now()
    returning user_id
  loop
    perform private.notify(s.user_id, 'subscription_changed', 'Plano encerrado',
      'Sua assinatura terminou e você voltou ao plano Gratuito.', null, '{}'::jsonb);
    v_subs := v_subs + 1;
  end loop;

  perform set_config('app.system', 'off', true);
  return jsonb_build_object('events_finished', v_finished, 'events_started', v_started,
    'registration_holds_expired', v_holds, 'team_holds_expired', v_team_holds,
    'invites_expired', v_invites, 'subscriptions_ended', v_subs);
end $$;
