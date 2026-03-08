// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { useState, useEffect, useCallback, useRef } from "react";
import { EDIT_MODE, RUNTIME_MODE, type Mode } from "@src/constants/constants";
import { useWidgetManager } from "./useWidgetManager";
import type { ExportedWidget } from "@src/types/widgets";
import useEpicsWS from "./useEpicsWS";
import {
  authService,
  Roles,
  type OAuthProvider,
  type AuthStatus,
  AuthStatuses,
} from "@src/services/AuthService/AuthService";
import { notifyUser } from "@src/services/Notifications/Notification";
import {
  getAllDeployedReposTree,
  getAllReposTree,
  updateStagingRepoFile,
  type DeploymentTreeInfo,
  type StagingTreeInfo,
  type User,
} from "@src/services/APIClient";

export interface SelectedPathInfo {
  repo_id: string;
  path: string;
}

/**
 * Hook that manages global UI state for WEISS.
 */
export default function useUIManager(
  ws: ReturnType<typeof useEpicsWS>,
  setSelectedWidgetIDs: ReturnType<typeof useWidgetManager>["setSelectedWidgetIDs"],
  editorWidgets: ReturnType<typeof useWidgetManager>["editorWidgets"],
  formatWdgToExport: ReturnType<typeof useWidgetManager>["formatWdgToExport"],
  fileLoadedTrig: ReturnType<typeof useWidgetManager>["fileLoadedTrig"],
  clearAllWidgets: ReturnType<typeof useWidgetManager>["clearAllWidgets"],
) {
  const lastFileLoadedTrig = useRef(0);
  const hasFileChanged = useRef(true);
  const hasClearedForNoFileRef = useRef(false);
  const lastSavedRef = useRef<ExportedWidget[] | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const [releaseShortcuts, setReleaseShortcuts] = useState(false);
  const [wdgPickerOpen, setWdgPickerOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(EDIT_MODE);
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [user, setUser] = useState<User | null>(() => authService.getUser());
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [reposTreeInfo, setReposTreeInfo] = useState<
    (StagingTreeInfo | DeploymentTreeInfo)[] | null
  >(null);
  const [isReposLoading, setIsReposLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<SelectedPathInfo | null>(null);
  const inEditMode = mode === EDIT_MODE;
  const RECONNECT_TIMEOUT = 3000;
  const isDemo = import.meta.env.VITE_DEMO_MODE === "true";
  const isDeveloper = user?.role === Roles.DEVELOPER;

  const updateReposTreeInfo = useCallback(async () => {
    setIsReposLoading(true);
    try {
      const response = isDeveloper ? await getAllReposTree() : await getAllDeployedReposTree();
      const data = response.data;
      setReposTreeInfo(data.length > 0 ? data : null);
    } catch (error) {
      notifyUser(`Failed to fetch repositories: ${String(error)}`, "error");
    } finally {
      setIsReposLoading(false);
    }
  }, [isDeveloper]);

  useEffect(() => {
    void updateReposTreeInfo();
  }, [updateReposTreeInfo]);

  useEffect(() => {
    if (authChecked) return;
    void authService.restoreSession().finally(() => setAuthChecked(true));
  }, [authChecked]);

  // ensure session is restored after file change
  useEffect(() => {
    if (!inEditMode) {
      ws.startNewSession();
      lastFileLoadedTrig.current = fileLoadedTrig;
    }
    hasFileChanged.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileLoadedTrig]);

  const updateMode = useCallback(
    (newMode: Mode) => {
      const isEdit = newMode === EDIT_MODE;
      if (isEdit) {
        ws.stopSession();
      } else {
        setSelectedWidgetIDs([]);
        setWdgPickerOpen(false);
        ws.startNewSession();
      }
      setMode(newMode);
    },
    [setSelectedWidgetIDs, ws],
  );

  useEffect(() => {
    const authHandlers = {
      onAuthStatusChange(status: AuthStatus, user: User | null) {
        setUser(user);
        setIsAuthenticated(status === AuthStatuses.AUTHENTICATED);
        if (user?.role === Roles.OPERATOR) {
          updateMode(RUNTIME_MODE);
        }
      },
      onLogout() {
        // Additional logout handling if needed
      },
    };

    const unsubscribe = authService.subscribe(authHandlers);
    return unsubscribe;
  }, [updateMode]);

  const login = useCallback(
    async (provider: OAuthProvider, demoProfile?: Roles) => {
      if (isAuthenticated) return;
      await authService.login(provider, demoProfile);
    },
    [isAuthenticated],
  );

  const logout = useCallback(() => {
    void authService.logout();
  }, []);

  /**
   * Handles WS reconnection when needed
   */
  useEffect(() => {
    if (inEditMode || ws.wsConnected) return;

    let triedReconnect = false;

    const intervalId = setInterval(() => {
      if (!inEditMode && !ws.wsConnected) {
        triedReconnect = true;
        console.warn("Socket disconnected. Attempting reconnection...");
        notifyUser("Connection lost. Attempting to reconnect...", "warning");
        ws.startNewSession();
      }
    }, RECONNECT_TIMEOUT);

    return () => {
      clearInterval(intervalId);
      if (triedReconnect) {
        notifyUser("Reconnected to server.", "success");
      }
    };
  }, [inEditMode, ws]);

  useEffect(() => {
    if (!selectedFile) {
      if (hasClearedForNoFileRef.current) return;
      clearAllWidgets();
      hasClearedForNoFileRef.current = true;
      return;
    }
    hasClearedForNoFileRef.current = false;
  }, [clearAllWidgets, selectedFile]);
  // throttle file update to backend
  useEffect(() => {
    if (!isDeveloper || !inEditMode) return;
    if (!selectedFile?.repo_id || !selectedFile.path) return;
    // Skip the first render after selecting a new file
    if (hasFileChanged.current) {
      hasFileChanged.current = false;
      return;
    }
    const exportable = editorWidgets.map(formatWdgToExport);
    // Skip if content didn't change
    if (lastSavedRef.current === exportable) return;
    const serialized = JSON.stringify(exportable, null, 2);

    // debounce
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const updateFileContent = async () => {
      try {
        const updtd = await updateStagingRepoFile({
          path: { repo_id: selectedFile.repo_id },
          query: { path: selectedFile.path },
          body: { content: serialized },
        }).then((r) => r.data);

        setReposTreeInfo((prev) => {
          if (!prev) return prev;
          return prev.map((r) => (r.id === updtd.id ? updtd : r));
        });
        lastSavedRef.current = exportable;
      } catch (err) {
        notifyUser(`Failed to save file: ${err as string}`, "error");
      }
    };

    saveTimeoutRef.current = window.setTimeout(() => void updateFileContent(), 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editorWidgets, selectedFile, isDeveloper, inEditMode, formatWdgToExport, setReposTreeInfo]);

  return {
    releaseShortcuts,
    setReleaseShortcuts,
    mode,
    updateMode,
    wdgPickerOpen,
    setWdgPickerOpen,
    inEditMode,
    isDragging,
    setIsDragging,
    isPanning,
    setIsPanning,
    isDemo,
    user,
    isDeveloper,
    authChecked,
    isAuthenticated,
    login,
    logout,
    reposTreeInfo,
    setReposTreeInfo,
    updateReposTreeInfo,
    isReposLoading,
    selectedFile,
    setSelectedFile,
  };
}
