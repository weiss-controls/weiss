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
  getDeployedRepoFile,
  getStagingRepoFile,
  updateStagingRepoFile,
  getTokenStatus,
  type DeploymentTreeInfo,
  type StagingTreeInfo,
  type TokenStatus,
  type User,
} from "@src/services/APIClient";

const IMAGE_EXTENSIONS = new Set([".svg", ".png", ".jpg", ".jpeg"]);
const MIME_MAP: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};
function buildDataUrl(path: string, content: string, encoding: string): string {
  const dot = path.lastIndexOf(".");
  const ext = dot !== -1 ? path.slice(dot).toLowerCase() : "";
  const mime = MIME_MAP[ext] ?? "application/octet-stream";
  if (encoding === "base64") return `data:${mime};base64,${content}`;
  return `data:${mime};charset=utf-8,${encodeURIComponent(content)}`;
}
function isImageFile(path: string): boolean {
  const dot = path.lastIndexOf(".");
  return dot !== -1 && IMAGE_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

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
  fileImportedTrig: ReturnType<typeof useWidgetManager>["fileImportedTrig"],
  clearAllWidgets: ReturnType<typeof useWidgetManager>["clearAllWidgets"],
  loadWidgets: ReturnType<typeof useWidgetManager>["loadWidgets"],
  snapshotEditModeMacros: ReturnType<typeof useWidgetManager>["snapshotEditModeMacros"],
  restoreEditModeMacros: ReturnType<typeof useWidgetManager>["restoreEditModeMacros"],
) {
  const hasFileChanged = useRef(true);
  const restoredRef = useRef(false);
  const lastSavedRef = useRef<ExportedWidget[] | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const [isTextEditing, setIsTextEditing] = useState(false);
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
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const inEditMode = mode === EDIT_MODE;
  const RECONNECT_TIMEOUT = 3000;
  const isDemo = import.meta.env.VITE_DEMO_MODE === "true";
  const isDeveloper = user?.role === Roles.DEVELOPER;

  const updateReposTreeInfo = useCallback(async () => {
    if (!isAuthenticated) return;
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
  }, [isDeveloper, isAuthenticated]);

  useEffect(() => {
    void updateReposTreeInfo();
  }, [updateReposTreeInfo]);

  useEffect(() => {
    if (!isDeveloper || !isAuthenticated) {
      setTokenStatus(null);
      return;
    }
    void getTokenStatus().then((r) => setTokenStatus(r.data));
  }, [isDeveloper, isAuthenticated]);

  useEffect(() => {
    if (authChecked) return;
    void authService.restoreSession().finally(() => setAuthChecked(true));
  }, [authChecked]);

  // Reset the auto-save guard on every file load
  useEffect(() => {
    hasFileChanged.current = true;
  }, [fileLoadedTrig]);

  // On local file import, clear the guard so auto-save fires immediately
  useEffect(() => {
    if (fileImportedTrig === 0) return;
    hasFileChanged.current = false;
  }, [fileImportedTrig]);

  const updateMode = useCallback(
    (newMode: Mode) => {
      const isEdit = newMode === EDIT_MODE;
      if (isEdit) {
        restoreEditModeMacros();
        ws.stopSession();
      } else {
        snapshotEditModeMacros();
        setSelectedWidgetIDs([]);
        setWdgPickerOpen(false);
        ws.startNewSession();
      }
      setMode(newMode);
    },
    [setSelectedWidgetIDs, ws, snapshotEditModeMacros, restoreEditModeMacros],
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
        setReposTreeInfo(null);
        setSelectedFile(null);
        setIsReposLoading(false);
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

  // Fetch and load file whenever selectedFile changes.
  useEffect(() => {
    if (!selectedFile) {
      clearAllWidgets();
      setImageSrc(null);
      setImageName(null);
      return;
    }
    let cancelled = false;
    const fetchFile = async () => {
      try {
        const res = isDeveloper
          ? await getStagingRepoFile({
              path: { repo_id: selectedFile.repo_id },
              query: { path: selectedFile.path },
            })
          : await getDeployedRepoFile({
              path: { repo_id: selectedFile.repo_id },
              query: { path: selectedFile.path },
            });
        if (cancelled) return;
        if (isImageFile(selectedFile.path)) {
          const { content, encoding } = res.data;
          setImageSrc(buildDataUrl(selectedFile.path, content, encoding ?? "utf-8"));
          setImageName(selectedFile.path.slice(selectedFile.path.lastIndexOf("/") + 1));
        } else {
          setImageSrc(null);
          setImageName(null);
          loadWidgets(res.data.content);
          localStorage.setItem("lastLoadedFile", JSON.stringify(selectedFile));
        }
      } catch (err) {
        if (!cancelled) notifyUser(`Failed to load file: ${String(err)}`, "error");
      }
    };
    void fetchFile();
    return () => {
      cancelled = true;
    };
  }, [selectedFile, isDeveloper, clearAllWidgets, loadWidgets]);

  // Restore the last opened file on first load once repos are available.
  useEffect(() => {
    if (restoredRef.current || !reposTreeInfo?.length) return;
    restoredRef.current = true;
    const raw = localStorage.getItem("lastLoadedFile");
    if (!raw) return;
    const parsed = JSON.parse(raw) as SelectedPathInfo;
    if (!reposTreeInfo.find((r) => r.id === parsed.repo_id)) return;
    setSelectedFile(parsed);
  }, [reposTreeInfo]);

  // Force re-fetch of the current file (e.g. after a git sync).
  const reloadSelectedFile = useCallback(() => {
    setSelectedFile((prev) => (prev ? { ...prev } : null));
  }, []);

  // throttle file update to backend
  useEffect(() => {
    if (!isDeveloper || !inEditMode) return;
    if (!selectedFile?.repo_id || !selectedFile.path) return;
    if (!selectedFile.path.toLowerCase().endsWith(".opi.json")) return;
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
    isTextEditing,
    setIsTextEditing,
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
    setIsReposLoading,
    selectedFile,
    setSelectedFile,
    reloadSelectedFile,
    imageSrc,
    imageName,
    tokenStatus,
  };
}
