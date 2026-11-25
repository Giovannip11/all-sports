-- TOUR-01 — criação de torneio pela API.
--
-- Um torneio é um evento (kind = 'tournament') + a linha em `tournaments`, e o
-- trigger `events_tournament_row_chk` (0005) exige as duas na MESMA transação.
-- Pela API REST (PostgREST) cada chamada é uma transação separada, então o
-- backend precisa desta função para criar as duas linhas juntas.
--
-- Regras de plano continuam nos triggers existentes: `create_tournament`
-- (Intermediário+), `max_teams_per_tournament` e `max_active_tournaments`.

set search_path = public, extensions;

create function public.create_tournament_event(
  p_sport_id     smallint,
  p_title        text,
  p_description  text,
  p_location     text,
  p_latitude     double precision,
  p_longitude    double precision,
  p_starts_at    timestamptz,
  p_max_teams    int,
  p_players_min  smallint default 1,
  p_players_max  smallint default 1,
  p_prize        text default null,
  p_visibility   public.event_visibility default 'public'
) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.events (
    organizer_id, sport_id, title, description, kind, visibility, status,
    starts_at, ends_at, location_name, latitude, longitude, max_participants
  ) values (
    v_uid, p_sport_id, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''),
    'tournament', p_visibility, 'open',
    -- Um campeonato amador costuma ocupar o dia; o fim só precisa ser > início.
    p_starts_at, p_starts_at + interval '8 hours',
    btrim(p_location), p_latitude, p_longitude, null
  ) returning id into v_id;

  insert into public.tournaments (
    event_id, max_teams, min_teams, players_per_team_min, players_per_team_max, prize_description
  ) values (
    v_id, p_max_teams, 2, p_players_min, greatest(p_players_min, p_players_max),
    nullif(btrim(coalesce(p_prize, '')), '')
  );

  return v_id;
end $$;

revoke all on function public.create_tournament_event(
  smallint, text, text, text, double precision, double precision, timestamptz,
  int, smallint, smallint, text, public.event_visibility
) from public, anon;
grant execute on function public.create_tournament_event(
  smallint, text, text, text, double precision, double precision, timestamptz,
  int, smallint, smallint, text, public.event_visibility
) to authenticated;
