import { createContext, useContext, useState, type ReactNode } from 'react';

import * as api from '@/lib/api';

type SignUpInput = {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: api.Role;
};

type ProfilePatch = { name?: string; phone?: string; bio?: string };

type AuthContextValue = {
  user: api.ApiUser | null;
  accessToken: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** Returns true if the account needs e-mail confirmation before it can sign in. */
  signUp: (input: SignUpInput) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => void;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
  uploadAvatar: (file: { uri: string; name: string; type: string }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<api.ApiUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  async function signIn(email: string, password: string) {
    const result = await api.login({ email, password });
    setUser(result.user);
    setAccessToken(result.session.access_token);
  }

  async function signUp(input: SignUpInput) {
    const result = await api.signup(input);
    if (result.session) {
      setUser(result.user);
      setAccessToken(result.session.access_token);
      return { needsEmailConfirmation: false };
    }
    return { needsEmailConfirmation: true };
  }

  function signOut() {
    setUser(null);
    setAccessToken(null);
  }

  async function updateProfile(patch: ProfilePatch) {
    if (!accessToken) throw new Error('Não autenticado');
    const updated = await api.updateProfile(accessToken, patch);
    setUser(updated);
  }

  async function uploadAvatar(file: { uri: string; name: string; type: string }) {
    if (!accessToken) throw new Error('Não autenticado');
    const updated = await api.uploadAvatar(accessToken, file);
    setUser(updated);
  }

  return (
    <AuthContext.Provider
      value={{ user, accessToken, signIn, signUp, signOut, updateProfile, uploadAvatar }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
