// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "@src/index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AuthCallback from "@src/routes/AuthCallback.tsx";
import LoginPage from "@src/routes/Login.tsx";
import ProtectedRoute from "@src/routes/ProtectedRoute.tsx";
import NotificationService from "./services/Notifications/NotificationService";
import DialogService from "./services/Dialog/DialogService";
import LoadingScreen from "@src/routes/LoadingScreen.tsx";

// Each route loads its own code; the editor stores and their reactions load with App.
// Outside the archiver, the editor loads with the page, in parallel with the session check.
const loadApp = () => import("@src/App.tsx");
if (window.location.pathname !== "/archiver") void loadApp();

/* oxlint-disable react/only-export-components -- entry module, not hot-reloaded */
const App = lazy(loadApp);
const Archiver = lazy(() => import("@src/routes/Archiver.tsx"));
/* oxlint-enable react/only-export-components */

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <NotificationService />
      <DialogService />
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <App />
              </ProtectedRoute>
            }
          />
          <Route
            path="/archiver"
            element={
              <ProtectedRoute>
                <Archiver />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
);
