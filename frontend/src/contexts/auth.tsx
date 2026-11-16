import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, logout, refreshAccess, setAccess } from '../api/client';
import type { Features, User } from '../types';

const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  unavailable: boolean;
  features: Features | null;
  accept(token: string): Promise<void>;
  signOut(): Promise<void>;
  update(user: User): void;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, update] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [features, setFeatures] = useState<Features | null>(null);
  useEffect(() => {
    let active = true;
    void api<Features>('/auth/features').then(value => { if (active) setFeatures(value); }, () => {});
    void refreshAccess().then(found => found ? api<User>('/auth/me', 'GET', undefined, true) : null)
      .then(value => { if (active) update(value); }, () => { if (active) setUnavailable(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const accept = useCallback(async (token: string) => {
    setAccess(token);
    update(await api<User>('/auth/me', 'GET', undefined, true));
    setUnavailable(false);
  }, []);

  async function signOut() {
    await logout();
    update(null);
  }

  return <AuthContext.Provider value={{ user, loading, unavailable, features, accept, signOut, update }}>
    {children}
  </AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('Missing auth provider');
  return context;
}

