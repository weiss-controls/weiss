// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { useEffect, useRef } from "react";
import { RUNTIME_MODE } from "@src/constants/constants";
import { authService, Roles } from "@src/services/AuthService/AuthService";
import { notifyUser } from "@src/services/Notifications/Notification";
import { getDeployedRepoFile, getStagingRepoFile, getTokenStatus } from "@src/services/APIClient";
import { updateMode } from "@src/stores/actions";
import { useEditorStore } from "@src/stores/editorStore";
import { useRepoStore, type SelectedPathInfo } from "@src/stores/repoStore";
import { useSessionStore } from "@src/stores/sessionStore";
import { useUIStore } from "@src/stores/uiStore";
import { useWSStore } from "@src/stores/wsStore";

const RECONNECT_NOTICE_DELAY = 3000; //ms
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

/** App-wide effects tied to the React lifecycle; renders nothing. Mounted once in main.tsx. */
export default function AppEffects() {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const isDeveloper = useSessionStore((s) => s.isDeveloper);
  const inEditMode = useUIStore((s) => s.inEditMode);
  const wsConnected = useWSStore((s) => s.wsConnected);
  const selectedFile = useRepoStore((s) => s.selectedFile);
  const reposTreeInfo = useRepoStore((s) => s.reposTreeInfo);
  const restoredRef = useRef(false);

  useEffect(() => {
    void authService
      .restoreSession()
      .finally(() => useSessionStore.getState().setAuthChecked(true));
  }, []);

  useEffect(
    () =>
      authService.subscribe({
        onAuthStatusChange(status, user) {
          useSessionStore.getState().setAuthStatus(status, user);
          if (user?.role === Roles.OPERATOR) updateMode(RUNTIME_MODE);
        },
        onLogout() {
          useRepoStore.getState().reset();
        },
      }),
    [],
  );

  useEffect(() => {
    void useRepoStore.getState().updateReposTreeInfo();
  }, [isAuthenticated, isDeveloper]);

  useEffect(() => {
    const { setTokenStatus } = useSessionStore.getState();
    if (!isDeveloper || !isAuthenticated) {
      setTokenStatus(null);
      return;
    }
    void getTokenStatus().then((r) => setTokenStatus(r.data));
  }, [isDeveloper, isAuthenticated]);

  // WSClient reconnects with backoff; this only notifies when the connection stays lost
  useEffect(() => {
    if (inEditMode || wsConnected) return;
    let notified = false;
    const timeoutId = setTimeout(() => {
      notified = true;
      console.warn("Socket disconnected. Attempting reconnection...");
      notifyUser("Connection lost. Attempting to reconnect...", "warning");
    }, RECONNECT_NOTICE_DELAY);
    return () => {
      clearTimeout(timeoutId);
      if (notified) notifyUser("Reconnected to server.", "success");
    };
  }, [inEditMode, wsConnected]);

  // Load the selected file into the editor, or as an image
  useEffect(() => {
    const { setImage } = useRepoStore.getState();
    if (!selectedFile) {
      useEditorStore.getState().clearAllWidgets();
      setImage(null, null);
      return;
    }
    let cancelled = false;
    const fetchFile = async () => {
      try {
        const options = {
          path: { repo_id: selectedFile.repo_id },
          query: { path: selectedFile.path },
        };
        const res = isDeveloper
          ? await getStagingRepoFile(options)
          : await getDeployedRepoFile(options);
        if (cancelled) return;
        if (isImageFile(selectedFile.path)) {
          const { content, encoding } = res.data;
          setImage(
            buildDataUrl(selectedFile.path, content, encoding ?? "utf-8"),
            selectedFile.path.slice(selectedFile.path.lastIndexOf("/") + 1),
          );
        } else {
          setImage(null, null);
          useEditorStore.getState().loadWidgets(res.data.content);
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
  }, [selectedFile, isDeveloper]);

  // Restore the last opened file on first load once repos are available
  useEffect(() => {
    if (restoredRef.current || !reposTreeInfo?.length) return;
    restoredRef.current = true;
    const raw = localStorage.getItem("lastLoadedFile");
    if (!raw) return;
    const parsed = JSON.parse(raw) as SelectedPathInfo;
    if (!reposTreeInfo.find((r) => r.id === parsed.repo_id)) return;
    useRepoStore.getState().setSelectedFile(parsed);
  }, [reposTreeInfo]);

  return null;
}
