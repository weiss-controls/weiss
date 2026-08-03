// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authService, type OAuthProvider } from "@src/services/AuthService/AuthService";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const stateParam = params.get("state");
    const provider = stateParam?.split(":")[0] as OAuthProvider | null;

    if (!code || !provider || !stateParam) {
      console.error("OAuth callback missing parameters");
      void navigate("/login", { replace: true });
      return;
    }

    const redirectUri = `${window.location.origin}/auth/callback`;

    authService
      .handleCallback(provider, code, redirectUri, stateParam)
      .then(() => authService.restoreSession())
      .then(() => navigate("/", { replace: true }))
      .catch(() => navigate("/login", { replace: true }));
  }, [navigate]);

  return null;
}
