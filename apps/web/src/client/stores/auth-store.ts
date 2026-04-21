import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member' | 'viewer';
  githubLogin?: string | null;
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
  initiateGitHubOAuth: () => void;
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

        initiateGitHubOAuth: () => {
          window.location.href = '/api/auth/github';
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
