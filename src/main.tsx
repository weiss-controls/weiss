// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@src/index.css";
import { ContextProvider } from "@src/context/ContextProvider.tsx";
import App from "@src/App.jsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AuthCallback from "@src/routes/AuthCallback.tsx";
import LoginPage from "@src/routes/Login.tsx";
import ProtectedRoute from "@src/routes/ProtectedRoute.tsx";
import NotificationService from "./services/Notifications/NotificationService";
import DialogService from "./services/Dialog/DialogService";
import DryRunPage from "./routes/dryRun";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <NotificationService />
      <DialogService />
      <ContextProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* to be removed */}
          <Route path="/dry-run" element={<DryRunPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <App />
              </ProtectedRoute>
            }
          />
        </Routes>
      </ContextProvider>
    </BrowserRouter>
  </StrictMode>,
);
