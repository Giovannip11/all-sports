import { Platform } from 'react-native';

const DEFAULT_API_URL = Platform.select({
  android: 'http://10.0.2.2:8000',
  default: 'http://localhost:8000',
});

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL;

export type Role = 'practice' | 'organize';
export type Gender = 'masculino' | 'feminino' | 'outro' | 'prefiro_nao_informar';
export type Plan = 'gratuito' | 'casual' | 'intermediario' | 'arena';

export type ApiUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone: string | null;
  bio: string | null;
  avatar_url: string | null;
  location_consent: boolean;
  birth_date: string | null;
  cpf: string | null;
  gender: Gender | null;
  country: string | null;
  plan: Plan;
};

export type ApiSession = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

export class ApiError extends Error {}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  // Let fetch set its own multipart boundary for FormData bodies.
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: isFormData
        ? { 'ngrok-skip-browser-warning': 'true', ...options.headers }
        : {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
            ...options.headers,
          },
    });
  } catch {
    throw new ApiError(
      'Não foi possível conectar ao servidor. O backend está rodando?',
    );
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = body?.detail;
    const message = typeof detail === 'string' ? detail : 'Não foi possível completar a solicitação';
    throw new ApiError(message);
  }

  return body as T;
}

export function signup(input: {
  name: string;
  email: string;
  password: string;
  phone: string;
  birth_date: string;
  cpf: string;
  gender: Gender;
  country: string;
  role: Role;
  accepted_terms: boolean;
  location_consent: boolean;
  sports?: string[];
}) {
  return request<{ user: ApiUser; session: ApiSession | null; message: string }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function login(input: { email: string; password: string }) {
  return request<{ user: ApiUser; session: ApiSession }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function forgotPassword(email: string) {
  return request<void>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function me(accessToken: string) {
  return request<ApiUser>('/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function updateProfile(
  accessToken: string,
  patch: { name?: string; phone?: string; bio?: string; role?: Role },
) {
  return request<ApiUser>('/auth/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(patch),
  });
}

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

/** Esporte de interesse com o nível; a ordem da lista é a prioridade (RF05). */
export type ApiUserSport = { sport: string; skill_level: SkillLevel; position: number };

export function getMySports(accessToken: string) {
  return request<ApiUserSport[]>('/auth/me/sports', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function updateMySports(
  accessToken: string,
  sports: { sport: string; skill_level: SkillLevel }[],
) {
  return request<ApiUserSport[]>('/auth/me/sports', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ sports }),
  });
}

export function updatePlan(accessToken: string, plan: Plan) {
  return request<ApiUser>('/auth/me/plan', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ plan }),
  });
}

export async function uploadAvatar(
  accessToken: string,
  file: { uri: string; name: string; type: string },
) {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    // No navegador o FormData só aceita Blob/File: o objeto { uri, name, type }
    // virava o texto "[object Object]" e o upload falhava. A uri do seletor de
    // imagens na web é um blob:/data: URL, que dá para baixar como Blob.
    const blob = await (await fetch(file.uri)).blob();
    formData.append('file', new File([blob], file.name, { type: file.type || blob.type }));
  } else {
    // RN's FormData accepts this file-shaped object directly; DOM lib types don't model it.
    formData.append('file', file as unknown as Blob);
  }

  return request<ApiUser>('/auth/me/avatar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
}

export function deleteAccount(accessToken: string) {
  return request<void>('/auth/me', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

export type Visibility = 'public' | 'private';
export type EventStatus = 'draft' | 'open' | 'full' | 'in_progress' | 'finished' | 'canceled';

export type EventKind = 'pickup' | 'meetup' | 'tournament';

export type ApiEvent = {
  id: string;
  /** "tournament": vagas e inscritos contam equipes; abre a tela de torneio. */
  kind: EventKind;
  organizer_id: string;
  organizer_name: string;
  sport: string;
  title: string;
  description: string | null;
  location: string;
  latitude: number;
  longitude: number;
  starts_at: string;
  max_participants: number;
  visibility: Visibility;
  status: EventStatus;
  participants_count: number;
  is_participant: boolean;
  is_organizer: boolean;
  created_at: string;
};

export type ApiParticipant = {
  user_id: string;
  name: string;
  status: 'confirmed' | 'waitlisted' | 'canceled';
  presence_confirmed: boolean;
  joined_at: string;
};

export type ApiEventDetail = ApiEvent & { participants: ApiParticipant[] };

export type EventInput = {
  sport: string;
  title: string;
  description?: string;
  location: string;
  latitude: number;
  longitude: number;
  starts_at: string;
  max_participants: number;
  visibility: Visibility;
};

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

export function listEvents(accessToken: string, sport?: string) {
  const query = sport ? `?sport=${encodeURIComponent(sport)}` : '';
  return request<ApiEvent[]>(`/events${query}`, { headers: authHeaders(accessToken) });
}

export function getEvent(accessToken: string, eventId: string) {
  return request<ApiEventDetail>(`/events/${eventId}`, { headers: authHeaders(accessToken) });
}

export function createEvent(accessToken: string, input: EventInput) {
  return request<ApiEvent>('/events', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function updateEvent(accessToken: string, eventId: string, patch: Partial<EventInput> & { status?: EventStatus }) {
  return request<ApiEvent>(`/events/${eventId}`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify(patch),
  });
}

export function joinEvent(accessToken: string, eventId: string) {
  return request<ApiEvent>(`/events/${eventId}/join`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}

export function leaveEvent(accessToken: string, eventId: string) {
  return request<ApiEvent>(`/events/${eventId}/leave`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}

export function confirmPresence(accessToken: string, eventId: string) {
  return request<ApiEvent>(`/events/${eventId}/presence`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}

export function myEventHistory(accessToken: string) {
  return request<ApiEvent[]>('/events/me/history', { headers: authHeaders(accessToken) });
}

// ---------------------------------------------------------------------------
// Sorteio de times
// ---------------------------------------------------------------------------

export type TeamMode = 'random' | 'balanced';

export type ApiTeamMember = {
  user_id: string;
  name: string;
  events_played: number;
  skill_level: SkillLevel | null;
};

export type ApiTeam = {
  id: string;
  name: string;
  position: number;
  members: ApiTeamMember[];
};

export type ApiTeamDraw = {
  id: string;
  mode: TeamMode;
  team_count: number;
  created_at: string;
  teams: ApiTeam[];
};

export function getTeams(accessToken: string, eventId: string) {
  return request<ApiTeamDraw>(`/events/${eventId}/teams`, { headers: authHeaders(accessToken) });
}

export function drawTeams(
  accessToken: string,
  eventId: string,
  input: { team_count: number; mode: TeamMode },
) {
  return request<ApiTeamDraw>(`/events/${eventId}/teams/draw`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

// ---------------------------------------------------------------------------
// Chat do evento
// ---------------------------------------------------------------------------

export type ApiMessage = {
  id: string;
  sender_id: string | null;
  sender_name: string;
  body: string;
  created_at: string;
  is_mine: boolean;
};

export function listMessages(accessToken: string, eventId: string) {
  return request<ApiMessage[]>(`/events/${eventId}/messages`, {
    headers: authHeaders(accessToken),
  });
}

export function sendMessage(accessToken: string, eventId: string, body: string) {
  return request<ApiMessage>(`/events/${eventId}/messages`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ body }),
  });
}

// ---------------------------------------------------------------------------
// Mapa
// ---------------------------------------------------------------------------

export type ApiMapMarker = {
  id: string;
  kind: EventKind;
  sport: string;
  title: string;
  location: string;
  latitude: number;
  longitude: number;
  starts_at: string;
  visibility: Visibility;
  status: EventStatus;
  participants_count: number;
  max_participants: number;
  is_organizer: boolean;
  is_participant: boolean;
};

export function listMapMarkers(accessToken: string, sport?: string) {
  const query = sport ? `?sport=${encodeURIComponent(sport)}` : '';
  return request<ApiMapMarker[]>(`/map/markers${query}`, { headers: authHeaders(accessToken) });
}

// ---------------------------------------------------------------------------
// Torneios (TOUR-01)
// ---------------------------------------------------------------------------

export type TournamentTeamStatus = 'pending' | 'confirmed' | 'waitlisted' | 'rejected' | 'canceled';

export type ApiTournamentTeam = {
  id: string;
  name: string;
  status: TournamentTeamStatus;
  captain_id: string | null;
  captain_name: string;
  is_mine: boolean;
};

export type ApiMatchTeam = { id: string; name: string };

export type ApiMatch = {
  id: string;
  round: number;
  position: number;
  status: 'scheduled' | 'in_progress' | 'finished' | 'walkover' | 'canceled';
  home: ApiMatchTeam | null;
  away: ApiMatchTeam | null;
  home_score: number | null;
  away_score: number | null;
  winner_team_id: string | null;
};

export type ApiTournament = {
  id: string;
  sport: string;
  title: string;
  description: string | null;
  location: string;
  latitude: number;
  longitude: number;
  starts_at: string;
  status: EventStatus;
  visibility: Visibility;
  organizer_id: string | null;
  organizer_name: string;
  is_organizer: boolean;
  max_teams: number;
  confirmed_teams: number;
  players_per_team_min: number;
  players_per_team_max: number;
  prize_description: string | null;
  requires_approval: boolean;
  teams: ApiTournamentTeam[];
  my_team_id: string | null;
  rounds: { round: number; name: string; matches: ApiMatch[] }[];
  champion: ApiMatchTeam | null;
};

export type TournamentInput = {
  sport: string;
  title: string;
  description?: string;
  location: string;
  latitude: number;
  longitude: number;
  starts_at: string;
  max_teams: number;
  players_per_team_min: number;
  players_per_team_max: number;
  prize_description?: string;
  visibility: Visibility;
};

export function createTournament(accessToken: string, input: TournamentInput) {
  return request<ApiTournament>('/tournaments', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function getTournament(accessToken: string, id: string) {
  return request<ApiTournament>(`/tournaments/${id}`, { headers: authHeaders(accessToken) });
}

export function registerTournamentTeam(accessToken: string, id: string, name: string) {
  return request<ApiTournament>(`/tournaments/${id}/teams`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ name }),
  });
}

export function cancelTournamentTeam(accessToken: string, teamId: string) {
  return request<ApiTournament>(`/tournaments/teams/${teamId}/cancel`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}

export function decideTournamentTeam(accessToken: string, teamId: string, approve: boolean) {
  return request<ApiTournament>(`/tournaments/teams/${teamId}/decision`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ approve }),
  });
}

export function generateBracket(accessToken: string, id: string) {
  return request<ApiTournament>(`/tournaments/${id}/bracket`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}

export function recordMatchResult(
  accessToken: string,
  id: string,
  matchId: string,
  result: { home_score: number; away_score: number; winner_team_id?: string | null },
) {
  return request<ApiTournament>(`/tournaments/${id}/matches/${matchId}`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify(result),
  });
}

/** Rota da tela certa para um evento: torneio tem tela própria. */
export function eventHref(event: { id: string; kind?: EventKind }) {
  return event.kind === 'tournament'
    ? (`/tournament/${event.id}` as const)
    : (`/event/${event.id}` as const);
}

// ---------------------------------------------------------------------------
// Notificações
// ---------------------------------------------------------------------------

export type ApiNotification = {
  id: string;
  event_id: string | null;
  type: string;
  title: string | null;
  message: string;
  read: boolean;
  created_at: string;
};

export function listNotifications(accessToken: string) {
  return request<ApiNotification[]>('/notifications', { headers: authHeaders(accessToken) });
}

export function markNotificationRead(accessToken: string, notificationId: string) {
  return request<ApiNotification>(`/notifications/${notificationId}/read`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}

export function markAllNotificationsRead(accessToken: string) {
  return request<{ ok: boolean }>('/notifications/read-all', {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}
