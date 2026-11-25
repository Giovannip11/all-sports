import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import * as api from '@/lib/api';

type SignUpInput = {
  name: string;
  email: string;
  password: string;
  phone: string;
  birth_date: string;
  cpf: string;
  gender: api.Gender;
  country: string;
  role: api.Role;
  accepted_terms: boolean;
  location_consent: boolean;
  sports?: string[];
};

type ProfilePatch = { name?: string; phone?: string; bio?: string; role?: api.Role };

type AuthContextValue = {
  user: api.ApiUser | null;
  accessToken: string | null;
  /** true enquanto a sessão salva é verificada na abertura do app. */
  restoring: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** Returns true if the account needs e-mail confirmation before it can sign in. */
  signUp: (input: SignUpInput) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => void;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
  uploadAvatar: (file: { uri: string; name: string; type: string }) => Promise<void>;
  updatePlan: (plan: api.Plan) => Promise<void>;
  deleteAccount: () => Promise<void>;
  /** Esportes de interesse em ordem de prioridade, com nível (RF05/USER-02). */
  mySports: api.ApiUserSport[];
  saveMySports: (sports: { sport: string; skill_level: api.SkillLevel }[]) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'all-sports-access-token';

// Sessão salva só onde há localStorage (web). No nativo não há armazenamento
// instalado no projeto, então lá a sessão continua só em memória.
function readStoredToken(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Armazenamento indisponível: a sessão fica só em memória.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<api.ApiUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(() => readStoredToken() !== null);
  const [mySports, setMySports] = useState<api.ApiUserSport[]>([]);

  // Esportes preferidos acompanham a sessão: carregam ao entrar, somem ao sair.
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    api
      .getMySports(accessToken)
      .then((sports) => {
        if (!cancelled) setMySports(sports);
      })
      .catch(() => {
        // Sem preferências a descoberta só não é personalizada.
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  // Recarregar a página (ou reiniciar o servidor de dev) não desloga mais:
  // o token salvo é validado no backend e, se expirou, é descartado.
  useEffect(() => {
    const token = readStoredToken();
    if (!token) return;
    let cancelled = false;
    api
      .me(token)
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setAccessToken(token);
      })
      .catch(() => {
        if (!cancelled) storeToken(null);
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function startSession(nextUser: api.ApiUser, token: string) {
    setUser(nextUser);
    setAccessToken(token);
    storeToken(token);
  }

  async function signIn(email: string, password: string) {
    const result = await api.login({ email, password });
    startSession(result.user, result.session.access_token);
  }

  async function signUp(input: SignUpInput) {
    const result = await api.signup(input);
    if (result.session) {
      startSession(result.user, result.session.access_token);
      return { needsEmailConfirmation: false };
    }
    return { needsEmailConfirmation: true };
  }

  function signOut() {
    setUser(null);
    setAccessToken(null);
    setMySports([]);
    storeToken(null);
  }

  async function saveMySports(sports: { sport: string; skill_level: api.SkillLevel }[]) {
    if (!accessToken) throw new Error('Não autenticado');
    setMySports(await api.updateMySports(accessToken, sports));
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

  async function updatePlan(plan: api.Plan) {
    if (!accessToken) throw new Error('Não autenticado');
    const updated = await api.updatePlan(accessToken, plan);
    setUser(updated);
  }

  async function deleteAccount() {
    if (!accessToken) throw new Error('Não autenticado');
    await api.deleteAccount(accessToken);
    signOut();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        restoring,
        signIn,
        signUp,
        signOut,
        updateProfile,
        uploadAvatar,
        updatePlan,
        deleteAccount,
        mySports,
        saveMySports,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
