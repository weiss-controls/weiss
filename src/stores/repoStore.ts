// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { authService } from "@src/services/AuthService/AuthService";
import { notifyUser } from "@src/services/Notifications/Notification";
import {
  getAllDeployedReposTree,
  getAllReposTree,
  getDeployedRepoFile,
  getStagingRepoFile,
  type DeploymentTreeInfo,
  type StagingTreeInfo,
} from "@src/services/APIClient";
import { useEditorStore } from "./editorStore";
import { useSessionStore } from "./sessionStore";

const LAST_FILE_KEY = "lastLoadedFile";
const IMAGE_MIME_TYPES: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

/** MIME type of an image file path, or undefined for other files */
function imageMimeType(path: string): string | undefined {
  const dot = path.lastIndexOf(".");
  return dot !== -1 ? IMAGE_MIME_TYPES[path.slice(dot).toLowerCase()] : undefined;
}

export interface SelectedPathInfo {
  repo_id: string;
  path: string;
}

/**
 * How a selected file change reaches the URL: "push" adds a history entry, "replace" and
 * "restore" (the last opened file) replace it, "pop" comes from back/forward navigation.
 */
export type SelectionNav = "push" | "replace" | "restore" | "pop";

type ReposTreeInfo = (StagingTreeInfo | DeploymentTreeInfo)[] | null;

interface RepoStoreState {
  reposTreeInfo: ReposTreeInfo;
  isReposLoading: boolean;
  /** File open in the editor (or shown as an image); loaded when it changes */
  selectedFile: SelectedPathInfo | null;
  selectionNav: SelectionNav;
  /** Last file or folder selected in a project tree; "" is the repository root */
  treeSelection: SelectedPathInfo | null;
  imageSrc: string | null;
  imageName: string | null;
  setReposTreeInfo: (info: ReposTreeInfo | ((prev: ReposTreeInfo) => ReposTreeInfo)) => void;
  setIsReposLoading: (isReposLoading: boolean) => void;
  setSelectedFile: (file: SelectedPathInfo | null, nav?: SelectionNav) => void;
  setTreeSelection: (selection: SelectedPathInfo | null) => void;
  /** Fetches the current file again (e.g. after a git sync). */
  reloadSelectedFile: () => void;
  setImage: (imageSrc: string | null, imageName: string | null) => void;
  /** Fetches the repository trees the user can see. */
  updateReposTreeInfo: () => Promise<void>;
  reset: () => void;
}

/** Repositories, their trees and the selected file */
export const useRepoStore = create<RepoStoreState>()(
  devtools(
    (set) => ({
      reposTreeInfo: null,
      isReposLoading: true,
      selectedFile: null,
      selectionNav: "replace",
      treeSelection: null,
      imageSrc: null,
      imageName: null,
      setReposTreeInfo: (info) =>
        set((s) => ({ reposTreeInfo: typeof info === "function" ? info(s.reposTreeInfo) : info })),
      setIsReposLoading: (isReposLoading) => set({ isReposLoading }),
      setSelectedFile: (selectedFile, selectionNav = "push") => set({ selectedFile, selectionNav }),
      setTreeSelection: (treeSelection) => set({ treeSelection }),
      reloadSelectedFile: () =>
        set((s) => ({
          selectedFile: s.selectedFile ? { ...s.selectedFile } : null,
          selectionNav: "replace",
        })),
      setImage: (imageSrc, imageName) => set({ imageSrc, imageName }),
      updateReposTreeInfo,
      reset: () =>
        set({
          reposTreeInfo: null,
          selectedFile: null,
          selectionNav: "replace",
          treeSelection: null,
          isReposLoading: false,
        }),
    }),
    { name: "repoStore", enabled: import.meta.env.DEV },
  ),
);

async function updateReposTreeInfo() {
  const { isAuthenticated, isDeveloper } = useSessionStore.getState();
  if (!isAuthenticated) return;
  useRepoStore.setState({ isReposLoading: true });
  try {
    const response = isDeveloper ? await getAllReposTree() : await getAllDeployedReposTree();
    useRepoStore.setState({ reposTreeInfo: response.data.length > 0 ? response.data : null });
  } catch (error) {
    notifyUser(`Failed to fetch repositories: ${String(error)}`, "error");
  } finally {
    useRepoStore.setState({ isReposLoading: false });
  }
}

// Repository trees follow the login and role; logging out clears them
useSessionStore.subscribe((state, prev) => {
  if (state.isAuthenticated !== prev.isAuthenticated || state.isDeveloper !== prev.isDeveloper)
    void useRepoStore.getState().updateReposTreeInfo();
});
// The editor loads after login, so the trees of an existing session are fetched on load
if (useSessionStore.getState().isAuthenticated) void useRepoStore.getState().updateReposTreeInfo();
authService.subscribe({ onLogout: () => useRepoStore.getState().reset() });

let loadRequest = 0;

/** Loads the selected file into the editor, or as an image; a newer request supersedes it. */
async function loadSelectedFile() {
  const request = ++loadRequest;
  const { selectedFile, selectionNav, setImage } = useRepoStore.getState();
  if (!selectedFile) {
    useEditorStore.getState().clearAllWidgets();
    setImage(null, null);
    return;
  }
  try {
    const options = {
      path: { repo_id: selectedFile.repo_id },
      query: { path: selectedFile.path },
    };
    const res = useSessionStore.getState().isDeveloper
      ? await getStagingRepoFile(options)
      : await getDeployedRepoFile(options);
    if (request !== loadRequest) return;
    const mime = imageMimeType(selectedFile.path);
    if (mime) {
      const { content, encoding } = res.data;
      const src =
        encoding === "base64"
          ? `data:${mime};base64,${content}`
          : `data:${mime};charset=utf-8,${encodeURIComponent(content)}`;
      setImage(src, selectedFile.path.slice(selectedFile.path.lastIndexOf("/") + 1));
    } else {
      setImage(null, null);
      useEditorStore.getState().loadWidgets(res.data.content);
      localStorage.setItem(LAST_FILE_KEY, JSON.stringify(selectedFile));
    }
  } catch (err) {
    if (request !== loadRequest) return;
    if (selectionNav === "restore") {
      localStorage.removeItem(LAST_FILE_KEY);
      notifyUser(`Could not restore the last opened file (${selectedFile.path})`, "warning");
    } else {
      notifyUser(`Failed to load file: ${String(err)}`, "error");
    }
    useRepoStore.getState().setSelectedFile(null, "replace");
  }
}

useRepoStore.subscribe((state, prev) => {
  if (state.selectedFile === prev.selectedFile) return;
  void loadSelectedFile();
  const path = state.selectedFile?.path;
  document.title = path ? `${path.slice(path.lastIndexOf("/") + 1)} - WEISS` : "WEISS";
});
useSessionStore.subscribe((state, prev) => {
  if (state.isDeveloper !== prev.isDeveloper) void loadSelectedFile();
});

/** Opens the last file loaded in the editor, if any; warns when it is no longer available. */
export function restoreLastFile() {
  const raw = localStorage.getItem(LAST_FILE_KEY);
  if (!raw) return;
  const last = JSON.parse(raw) as SelectedPathInfo;
  const { reposTreeInfo, setSelectedFile } = useRepoStore.getState();
  if (reposTreeInfo?.some((r) => r.id === last.repo_id)) {
    setSelectedFile(last, "restore");
  } else {
    localStorage.removeItem(LAST_FILE_KEY);
    notifyUser(`Could not restore the last opened file (${last.path})`, "warning");
  }
}
