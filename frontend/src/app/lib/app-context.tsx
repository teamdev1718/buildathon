import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/auth';
import { IconCheck } from '../ui/Icons';

export type Staff = { role: 'MAHALLU_ADMIN' | 'VOLUNTEER'; mahalluId: string; mahalluName: string };
export type Linked = { id: string; mahalluNumber: string; ownerName: string; memberCount: number; mahalluId: string; mahalluName: string };
type Context = { staff: Staff[]; households: Linked[] };
type Toast = { id: number; message: string };

const AppContext = createContext<{
  ctx: Context | null; loading: boolean; error: boolean;
  isSuper: boolean; adminOf: Staff[]; activeMahallu: Staff | null; setActiveMahalluId(id: string): void;
  reload(): Promise<void>; setContext(next: Context): void; toast(message: string): void;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [ctx, setContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const reload = useCallback(async () => {
    try { setContext(await api<Context>('/me/context', 'GET', undefined, true)); setError(false); }
    catch { setError(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (user) void reload(); }, [user, reload]);

  const toast = useCallback((message: string) => {
    const id = nextId.current++;
    setToasts(list => [...list, { id, message }]);
    setTimeout(() => setToasts(list => list.filter(item => item.id !== id)), 3800);
  }, []);

  const value = useMemo(() => {
    const adminOf = (ctx?.staff ?? []).filter(item => item.role === 'MAHALLU_ADMIN');
    return {
      ctx, loading, error, reload, setContext, toast, adminOf,
      isSuper: Boolean(user?.permissions.includes('mahallu.manage')),
      activeMahallu: adminOf.find(item => item.mahalluId === activeId) ?? adminOf[0] ?? null,
      setActiveMahalluId: setActiveId,
    };
  }, [ctx, loading, error, reload, toast, user, activeId]);

  return <AppContext.Provider value={value}>{children}
    {toasts.length > 0 && <div className="am"><div className="toast-wrap" aria-live="polite">
      {toasts.map(item => <div key={item.id} className="toast"><IconCheck /><span>{item.message}</span></div>)}
    </div></div>}
  </AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('Missing app provider');
  return value;
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'U';
export const greeting = () => { const hour = new Date().getHours(); return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'; };
