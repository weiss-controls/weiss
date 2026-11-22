// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import LoadingScreen from "@src/routes/LoadingScreen.tsx";
import { useSessionStore } from "@src/stores/sessionStore";
interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const authChecked = useSessionStore((s) => s.authChecked);

  if (!authChecked) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
