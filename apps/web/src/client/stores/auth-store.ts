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
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        token: null,
        user: null,
        isLoading: false,
        error: null,

        setAuth: (token, user) => set({ token, user, error: null }),
        logout: () => set({ token: null, user: null }),
        setIsLoading: (isLoading) => set({ isLoading }),
        setError: (error) => set({ error }),
      }),
      { name: 'aperant-auth' }
    ),
    { name: 'auth-store' }
  )
);
