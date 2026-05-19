import { create } from "zustand";
import { User } from "@/types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  /**
   * Convenience flag derived from `user`. Updated on every `setUser`
   * and `logout` so consumers can branch on a single boolean instead
   * of repeating `!!user` everywhere (and accidentally treating the
   * pre-bootstrap `null` as "unauthenticated").
   *
   * Note: `isAuthenticated` is only meaningful once `isLoading` is
   * false. Hooks that gate UI on auth should check both, e.g.
   *   if (!isLoading && !isAuthenticated) showLogin();
   */
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  setUser: (user) => set({ user, isLoading: false, isAuthenticated: !!user }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      set({ user: null, isAuthenticated: false });
    }
  },
}));
