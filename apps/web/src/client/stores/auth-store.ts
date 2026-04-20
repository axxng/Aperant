import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member' | 'viewer';
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;

  setAuth: (token: string, user: User) => void;
  logout: () => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  requestOtp: (email: string) => Promise<boolean>;
  verifyOtp: (email: string, code: string) => Promise<boolean>;
  checkSession: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        token: null,
        user: null,
        isLoading: false,
        error: null,

        setAuth: (token, user) => set({ token, user, error: null }),
        logout: () => set({ token: null, user: null }),
        setIsLoading: (isLoading) => set({ isLoading }),
        setError: (error) => set({ error }),

        requestOtp: async (email: string) => {
          set({ isLoading: true, error: null });
          try {
            const res = await fetch('/api/auth/request-otp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email }),
            });
            if (res.status === 429) {
              set({ error: 'rateLimited', isLoading: false });
              return false;
            }
            set({ isLoading: false });
            return true;
          } catch {
            set({ error: 'sendError', isLoading: false });
            return false;
          }
        },

        verifyOtp: async (email: string, code: string) => {
          set({ isLoading: true, error: null });
          try {
            const res = await fetch('/api/auth/verify-otp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, code }),
            });
            if (!res.ok) {
              set({ error: 'codeError', isLoading: false });
              return false;
            }
            const data = await res.json();
            set({ token: data.token, user: data.user, isLoading: false, error: null });
            return true;
          } catch {
            set({ error: 'codeError', isLoading: false });
            return false;
          }
        },

        checkSession: async () => {
          const { token } = get();
          if (!token) return false;
          try {
            const res = await fetch('/api/auth/me', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
              set({ token: null, user: null });
              return false;
            }
            const user = await res.json();
            set({ user });
            return true;
          } catch {
            set({ token: null, user: null });
            return false;
          }
        },
      }),
      { name: 'aperant-auth' }
    ),
    { name: 'auth-store' }
  )
);
