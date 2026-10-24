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
import { getTokenStatus, type TokenStatus, type User } from "@src/services/APIClient";

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

/** Authenticated user and session state, updated from AuthService callbacks */
export const useSessionStore = create<SessionStoreState>()(
  devtools(
    (set) => {
      const user = authService.getUser();
      return {
        user,
        isDeveloper: user?.role === Roles.DEVELOPER,
        authChecked: false,
        isAuthenticated: false,
        tokenStatus: null,
        isDemo: import.meta.env.VITE_DEMO_MODE === "true",
        setAuthStatus,
        setAuthChecked: (authChecked) => set({ authChecked }),
        setTokenStatus: (tokenStatus) => set({ tokenStatus }),
        login,
        logout: () => void authService.logout(),
      };
    },
    { name: "sessionStore", enabled: import.meta.env.DEV },
  ),
);

function setAuthStatus(status: AuthStatus, user: User | null) {
  useSessionStore.setState({
    user,
    isDeveloper: user?.role === Roles.DEVELOPER,
    isAuthenticated: status === AuthStatuses.AUTHENTICATED,
  });
}

async function login(provider: OAuthProvider, demoProfile?: Roles) {
  if (useSessionStore.getState().isAuthenticated) return;
  await authService.login(provider, demoProfile);
}

// Auth state follows AuthService; the session cookie is checked once on page load
authService.subscribe({
  onAuthStatusChange: (status, user) => useSessionStore.getState().setAuthStatus(status, user),
});
void authService.restoreSession().finally(() => useSessionStore.getState().setAuthChecked(true));

// Git token status of a logged-in developer
useSessionStore.subscribe((state, prev) => {
  if (state.isDeveloper === prev.isDeveloper && state.isAuthenticated === prev.isAuthenticated)
    return;
  if (!state.isDeveloper || !state.isAuthenticated) {
    state.setTokenStatus(null);
    return;
  }
  void getTokenStatus().then((r) => useSessionStore.getState().setTokenStatus(r.data));
});
