// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { notifyUser } from "@src/services/Notifications/Notification";
import { authGetAuthUrl, authCallback, authMe, authLogout } from "@src/services/APIClient";
import type { User } from "@src/services/APIClient";

// -----
// exceptionally, redefine these types from APIClient to allow usage as enum-like
export const OAuthProviders = {
  MICROSOFT: "microsoft",
  DEMO: "demo",
  OAUTH: "oauth",
} as const;

export type OAuthProvider = (typeof OAuthProviders)[keyof typeof OAuthProviders];

export const Roles = {
  DEVELOPER: "developer",
  OPERATOR: "operator",
} as const;

export type Roles = (typeof Roles)[keyof typeof Roles];

// -----
interface OAuthCallbackPayload {
  provider: OAuthProvider;
  code: string;
  redirect_uri: string;
  state?: string;
}

export const AuthStatuses = {
  AUTHENTICATED: 1,
  UNAUTHENTICATED: 0,
} as const;

export type AuthStatus = (typeof AuthStatuses)[keyof typeof AuthStatuses];

export interface AuthCallbacks {
  onAuthStatusChange?: (status: AuthStatus, user: User | null) => void;
  onLogin?: (user: User) => void;
  onLogout?: () => void;
  onAuthError?: (error: unknown) => void;
}

class AuthService {
  private callbacks = new Set<AuthCallbacks>();
  private currentUser: User | null = null;
  private callbackPromise: Promise<User | null> | null = null;

  subscribe(callbacks: AuthCallbacks): () => void {
    this.callbacks.add(callbacks);
    return () => this.callbacks.delete(callbacks);
  }

  private notifyAuthStatus(status: AuthStatus, user: User | null) {
    for (const cb of this.callbacks) cb.onAuthStatusChange?.(status, user);
  }

  private notifyLogin(user: User) {
    for (const cb of this.callbacks) cb.onLogin?.(user);
  }

  private notifyLogout() {
    for (const cb of this.callbacks) cb.onLogout?.();
  }

  private notifyError(err: unknown) {
    for (const cb of this.callbacks) cb.onAuthError?.(err);
  }

  private logAndNotifyError(err: unknown) {
    console.error("[AuthService]", err);
    this.notifyError(err);
  }

  async getAuthorizeUrl(provider: OAuthProvider, demoRole?: Roles): Promise<string | null> {
    try {
      const params = demoRole ? { demo_role: demoRole } : undefined;
      const response = await authGetAuthUrl({ path: { provider }, query: params }).then(
        (r) => r.data,
      );
      return response.authorize_url;
    } catch (err) {
      this.logAndNotifyError(err);
      return null;
    }
  }

  async login(provider: OAuthProvider, demoRole?: Roles) {
    try {
      const authorizeUrl = await this.getAuthorizeUrl(provider, demoRole);
      if (!authorizeUrl) throw new Error("No authorize URL returned");
      window.location.href = authorizeUrl;
    } catch (err) {
      this.logAndNotifyError(err);
      notifyUser("Login failed. Please, try again. If problem persists, contact support", "error");
    }
  }

  async handleCallback(
    provider: OAuthProvider,
    code: string,
    redirectUri: string,
    state?: string,
  ): Promise<User | null> {
    if (this.callbackPromise) return this.callbackPromise;

    this.callbackPromise = (async () => {
      try {
        const payload: OAuthCallbackPayload = { provider, code, redirect_uri: redirectUri, state };
        const user = await authCallback({ body: payload }).then((r) => r.data);
        this.currentUser = user;
        this.notifyLogin(user);
        this.notifyAuthStatus(AuthStatuses.AUTHENTICATED, user);
        return user;
      } catch (err) {
        this.logAndNotifyError(err);
        notifyUser(
          "Authentication failed. Auth code might have expired or was already used.",
          "error",
        );
        return null;
      } finally {
        this.callbackPromise = null;
      }
    })();

    return this.callbackPromise;
  }

  async restoreSession(): Promise<User | null> {
    if (this.callbackPromise) {
      return this.callbackPromise;
    }
    if (this.currentUser) {
      return this.currentUser;
    }
    try {
      const user = await authMe().then((r) => r.data);
      this.currentUser = user;
      this.notifyAuthStatus(AuthStatuses.AUTHENTICATED, user);
      return user;
    } catch {
      this.currentUser = null;
      this.notifyAuthStatus(AuthStatuses.UNAUTHENTICATED, null);
      return null;
    }
  }

  async logout() {
    try {
      await authLogout();
    } catch (err) {
      this.logAndNotifyError(err);
    } finally {
      this.currentUser = null;
      this.notifyLogout();
      this.notifyAuthStatus(AuthStatuses.UNAUTHENTICATED, null);
    }
  }

  /**
   * Clears local session state without contacting the backend.
   * Called when the server returns 401 (session expired or invalidated externally).
   * The guard ensures multiple simultaneous 401 responses only fire one notification.
   */
  expireSession(): void {
    if (!this.currentUser) return;
    this.currentUser = null;
    this.notifyLogout();
    this.notifyAuthStatus(AuthStatuses.UNAUTHENTICATED, null);
  }

  getUser(): User | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }
}

export const authService = new AuthService();
