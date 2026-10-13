import { Platform } from 'react-native';

const DEFAULT_API_URL = Platform.select({
  android: 'http://10.0.2.2:8000',
  default: 'http://localhost:8000',
});

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL;

export type Role = 'practice' | 'organize';

export type ApiUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
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
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
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

export function signup(input: { name: string; email: string; password: string; role: Role }) {
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
