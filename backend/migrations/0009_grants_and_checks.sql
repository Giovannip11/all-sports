set search_path = public, extensions;

revoke all on all tables    in schema public  from anon, authenticated;
revoke all on all sequences in schema public  from anon, authenticated;
revoke all on all functions in schema public  from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

grant select on public.sports, public.plans, public.permissions, public.plan_permissions to anon;

grant select on
  public.app_settings, public.sports, public.plans, public.permissions, public.plan_permissions,
  public.profiles, public.user_sports, public.user_consents, public.current_consents,
  public.subscriptions, public.current_subscriptions,
  public.notifications, public.notification_preferences, public.push_devices,
  public.user_blocks, public.follows, public.friendships, public.public_profiles, public.reports,
  public.venues, public.courts, public.court_sports, public.venue_opening_hours, public.event_series,
  public.events, public.event_invites, public.event_join_requests, public.event_registrations,
  public.events_with_availability, public.user_event_history, public.user_sport_stats,
  public.event_team_draws, public.event_teams, public.event_team_members,
  public.reviews, public.user_ratings,
  public.tournaments, public.tournament_phases, public.tournament_groups, public.tournament_teams,
  public.tournament_team_members, public.tournament_phase_teams, public.tournament_matches,
  public.tournament_standings,
  public.conversations, public.conversation_members, public.messages,
  public.audit_logs
to authenticated;

grant select (id, user_id, purpose, event_registration_id, tournament_team_id, plan_id, subscription_id,
              gateway, amount_cents, fee_cents, refunded_amount_cents, currency, method, card_brand, card_last4,
              status, failure_reason, paid_at, refunded_at, expires_at, created_at, updated_at)
  on public.payments to authenticated;
grant select (id, payment_id, amount_cents, reason, created_at) on public.payment_refunds to authenticated;

grant update (name, phone, bio, avatar_url, birth_date, gender, country, profile_visibility)
  on public.profiles to authenticated;
grant insert (user_id, sport_id, skill_level, position), update (skill_level, position), delete
  on public.user_sports to authenticated;
grant insert (user_id, kind, document_version, granted, ip, user_agent) on public.user_consents to authenticated;
grant insert (user_id, type, in_app, push), update (in_app, push), delete on public.notification_preferences to authenticated;
grant insert (user_id, token, platform), update (last_seen_at), delete on public.push_devices to authenticated;
grant update (read_at), delete on public.notifications to authenticated;

grant insert (blocker_id, blocked_id), delete on public.user_blocks to authenticated;
grant insert (follower_id, followee_id), update (status), delete on public.follows to authenticated;
grant insert (reporter_id, target_type, target_id, target_user_id, reason, details),
      update (status, resolution_note, handled_by) on public.reports to authenticated;

grant insert (name, description, address, city, state, country, latitude, longitude, phone, amenities,
              is_public, owner_id, created_by),
      update (name, description, address, city, state, country, latitude, longitude, phone, amenities,
              is_public, is_active),
      delete on public.venues to authenticated;
grant insert (venue_id, name, surface, indoor, capacity, hourly_price_cents, is_active),
      update (name, surface, indoor, capacity, hourly_price_cents, is_active),
      delete on public.courts to authenticated;
grant insert, delete on public.court_sports to authenticated;
grant insert (venue_id, weekday, opens_at, closes_at), update (weekday, opens_at, closes_at), delete
  on public.venue_opening_hours to authenticated;
grant insert (organizer_id, frequency, interval_count, weekdays, until_date), delete on public.event_series to authenticated;

grant insert (organizer_id, sport_id, series_id, series_position, venue_id, court_id, title, description,
              kind, visibility, status, skill_level, starts_at, ends_at, registration_deadline,
              location_name, address, city, state, latitude, longitude, max_participants, min_participants,
              waitlist_enabled, requires_approval, price_cents, currency, rules, promoted_until),
      update (sport_id, series_id, series_position, venue_id, court_id, title, description, visibility,
              status, skill_level, starts_at, ends_at, registration_deadline, location_name, address, city,
              state, latitude, longitude, max_participants, min_participants, waitlist_enabled,
              requires_approval, price_cents, rules, promoted_until, invite_code, cancel_reason),
      delete on public.events to authenticated;

grant insert (event_id, reviewer_id, reviewee_id, rating, comment), update (rating, comment), delete
  on public.reviews to authenticated;

grant insert (event_id, entry_fee_cents, max_teams, min_teams, players_per_team_min, players_per_team_max, prize_description),
      update (entry_fee_cents, max_teams, min_teams, players_per_team_min, players_per_team_max, prize_description)
  on public.tournaments to authenticated;
grant insert (tournament_id, position, name, format, points_win, points_draw, points_loss, legs,
              advance_per_group, third_place_match),
      update (position, name, format, points_win, points_draw, points_loss, legs, advance_per_group, third_place_match),
      delete on public.tournament_phases to authenticated;
grant insert (phase_id, tournament_id, name), update (name), delete on public.tournament_groups to authenticated;
grant insert (phase_id, tournament_id, team_id, group_id, seed), update (group_id, seed), delete
  on public.tournament_phase_teams to authenticated;
grant insert (tournament_id, phase_id, group_id, round, position, home_team_id, away_team_id, scheduled_at,
              venue_id, court_id, status, home_score, away_score, winner_team_id, score_detail,
              next_match_id, next_match_slot),
      update (group_id, round, position, home_team_id, away_team_id, scheduled_at, venue_id, court_id, status,
              home_score, away_score, winner_team_id, score_detail, next_match_id, next_match_slot),
      delete on public.tournament_matches to authenticated;

grant update (last_read_at, muted) on public.conversation_members to authenticated;
grant insert (conversation_id, sender_id, body, reply_to_id), update (body) on public.messages to authenticated;

do $$
declare
  v_allowed text[] := array[

    'is_platform_admin', 'my_plan', 'i_have_permission', 'my_permissions', 'is_blocked_with',
    'can_manage_venue', 'can_manage_court', 'is_event_organizer', 'is_registered_in_event', 'has_event_invite',
    'is_team_captain', 'is_tournament_participant', 'is_conversation_member', 'can_send_message',
    'immutable_unaccent', 'distance_meters', 'skill_rank',

    'cancel_my_subscription',
    'join_event', 'leave_event', 'confirm_presence', 'check_in_participant', 'lookup_event_by_code',
    'invite_user_to_event', 'respond_event_invite', 'revoke_event_invite',
    'decide_join_request', 'cancel_join_request', 'create_event_series', 'search_events_nearby', 'draw_event_teams',
    'register_tournament_team', 'invite_team_member', 'respond_team_invite', 'remove_team_member',
    'cancel_team', 'decide_team',
    'start_direct_conversation', 'create_group_conversation', 'add_group_member',
    'leave_conversation', 'mark_conversation_read', 'delete_message'];
  p record;
begin
  for p in select oid::regprocedure as sig from pg_proc
            where pronamespace = 'public'::regnamespace and proname = any (v_allowed) loop
    execute format('grant execute on function %s to authenticated', p.sig);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_select_own on storage.objects;
drop policy if exists avatars_insert_own on storage.objects;
drop policy if exists avatars_update_own on storage.objects;
drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_select_own on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables) then
    foreach t in array array['messages', 'notifications', 'events', 'event_registrations',
                             'tournament_matches', 'tournament_teams'] loop
      if not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      create extension pg_cron;
    exception when others then
      raise notice 'pg_cron indisponível: ative em Database > Extensions e rode esta seção (6) de novo.';
    end;
  end if;
  if to_regproc('cron.schedule') is not null then
    perform cron.schedule('allsports_tick',  '* * * * *', 'select private.tick()');
    perform cron.schedule('allsports_purge', '0 6 * * *', 'select private.purge_expired_data()');
  end if;
end $$;

do $$
declare
  v_bad text;
begin

  select string_agg(c.relname, ', ') into v_bad
    from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity;
  if v_bad is not null then raise exception 'Tabelas sem RLS: %', v_bad; end if;

  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_proc p where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
     and has_function_privilege('anon', p.oid, 'EXECUTE');
  if v_bad is not null then raise exception 'anon pode executar: %', v_bad; end if;

  select string_agg(c.relname, ', ') into v_bad
    from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'p')
     and has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
     and c.relname not in ('sports', 'plans', 'permissions', 'plan_permissions');
  if v_bad is not null then raise exception 'anon tem acesso a: %', v_bad; end if;

  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_proc p where p.pronamespace = 'private'::regnamespace
     and has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if v_bad is not null then raise exception 'authenticated executa funções internas: %', v_bad; end if;

  select string_agg(p.proname, ', ') into v_bad
    from pg_proc p where p.pronamespace = 'public'::regnamespace
     and has_function_privilege('authenticated', p.oid, 'EXECUTE')
     and p.proname in ('switch_plan', 'handle_new_user');
  if v_bad is not null then raise exception 'authenticated executa função só do backend: %', v_bad; end if;

  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_proc p where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
     and p.prosecdef and not coalesce(p.proconfig::text ilike '%search_path%', false);
  if v_bad is not null then raise exception 'SECURITY DEFINER sem search_path: %', v_bad; end if;

  select string_agg(viewname, ', ') into v_bad
    from pg_views where schemaname = 'public' and definition ilike '%private.%';
  if v_bad is not null then raise exception 'Views chamando private.*: %', v_bad; end if;

  select string_agg(c.relname, ', ') into v_bad
    from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'v'
     and c.relname not in ('public_profiles', 'user_ratings')
     and not coalesce(c.reloptions::text ilike '%security_invoker=true%', false);
  if v_bad is not null then raise exception 'Views sem security_invoker: %', v_bad; end if;
end $$;

notify pgrst, 'reload schema';
