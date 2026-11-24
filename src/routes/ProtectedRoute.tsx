// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import LoadingScreen from "@src/routes/LoadingScreen.tsx";
import { useSessionStore } from "@src/stores/sessionStore";
interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const authChecked = useSessionStore((s) => s.authChecked);
  const location = useLocation();

  if (!authChecked) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <>{children}</>;
}
