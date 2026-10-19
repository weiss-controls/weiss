// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  authService,
  AuthStatuses,
  Roles,
  type AuthStatus,
  type OAuthProvider,
} from "@src/services/AuthService/AuthService";
import type { TokenStatus, User } from "@src/services/APIClient";

interface SessionStoreState {
  user: User | null;
  isDeveloper: boolean;
  /** True once the session restore on page load finished */
  authChecked: boolean;
  isAuthenticated: boolean;
  /** Git token status of a developer */
  tokenStatus: TokenStatus | null;
  isDemo: boolean;
  setAuthStatus: (status: AuthStatus, user: User | null) => void;
  setAuthChecked: (authChecked: boolean) => void;
  setTokenStatus: (tokenStatus: TokenStatus | null) => void;
  login: (provider: OAuthProvider, demoProfile?: Roles) => Promise<void>;
  logout: () => void;
}

/** Authenticated user and session state, updated from AuthService callbacks (see AppEffects) */
export const useSessionStore = create<SessionStoreState>()(
  devtools(
    (set, get) => {
      const user = authService.getUser();
      return {
        user,
        isDeveloper: user?.role === Roles.DEVELOPER,
        authChecked: false,
        isAuthenticated: false,
        tokenStatus: null,
        isDemo: import.meta.env.VITE_DEMO_MODE === "true",
        setAuthStatus: (status, user) =>
          set({
            user,
            isDeveloper: user?.role === Roles.DEVELOPER,
            isAuthenticated: status === AuthStatuses.AUTHENTICATED,
          }),
        setAuthChecked: (authChecked) => set({ authChecked }),
        setTokenStatus: (tokenStatus) => set({ tokenStatus }),
        login: async (provider, demoProfile) => {
          if (get().isAuthenticated) return;
          await authService.login(provider, demoProfile);
        },
        logout: () => void authService.logout(),
      };
    },
    { name: "sessionStore", enabled: import.meta.env.DEV },
  ),
);
