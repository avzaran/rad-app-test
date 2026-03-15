import { create } from "zustand";
import { api } from "../api/repositories";
import { configureHttpAuth } from "../api/http";
import type { AuthUser, LoginRequest, UserRole } from "../types/auth";

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  bootstrapped: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
  refresh: () => Promise<string | null>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  bootstrapped: false,
  login: async (payload) => {
    const result = await api.login(payload);
    set({ accessToken: result.accessToken, user: result.user });
  },
  logout: async () => {
    await api.logout();
    set({ accessToken: null, user: null });
  },
  bootstrap: async () => {
    if (get().bootstrapped) {
      return;
    }

    try {
      const refresh = await api.refresh();
      const user = await api.me();
      set({ accessToken: refresh.accessToken, user, bootstrapped: true });
    } catch {
      set({ accessToken: null, user: null, bootstrapped: true });
    }
  },
  refresh: async () => {
    try {
      const result = await api.refresh();
      set({ accessToken: result.accessToken });
      return result.accessToken;
    } catch {
      set({ accessToken: null, user: null });
      return null;
    }
  },
}));

configureHttpAuth({
  getAccessToken: () => useAuthStore.getState().accessToken,
  refreshAccessToken: () => useAuthStore.getState().refresh(),
});

export function hasRequiredRole(role: UserRole | undefined, required: UserRole[]): boolean {
  if (!role) {
    return false;
  }
  return required.includes(role);
}
