import { Platform } from 'react-native';

const DEFAULT_API_URL = Platform.select({
  android: 'http://10.0.2.2:8000',
  default: 'http://localhost:8000',
});

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL;

export type Role = 'practice' | 'organize';
export type Gender = 'masculino' | 'feminino' | 'outro' | 'prefiro_nao_informar';

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

export function me(accessToken: string) {
  return request<ApiUser>('/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function updateProfile(
  accessToken: string,
  patch: { name?: string; phone?: string; bio?: string },
) {
  return request<ApiUser>('/auth/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(patch),
  });
}

export function uploadAvatar(
  accessToken: string,
  file: { uri: string; name: string; type: string },
) {
  const formData = new FormData();
  // RN's FormData accepts this file-shaped object directly; DOM lib types don't model it.
  formData.append('file', file as unknown as Blob);

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
export type EventStatus = 'active' | 'cancelled';

export type ApiEvent = {
  id: string;
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
  status: 'confirmed' | 'cancelled';
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
// Mapa
// ---------------------------------------------------------------------------

export type ApiMapMarker = {
  id: string;
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
// Notificações
// ---------------------------------------------------------------------------

export type ApiNotification = {
  id: string;
  event_id: string | null;
  type: string;
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
