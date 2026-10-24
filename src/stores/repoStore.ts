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

type ReposTreeInfo = (StagingTreeInfo | DeploymentTreeInfo)[] | null;

interface RepoStoreState {
  reposTreeInfo: ReposTreeInfo;
  isReposLoading: boolean;
  /** File open in the editor (or shown as an image); loaded when it changes */
  selectedFile: SelectedPathInfo | null;
  imageSrc: string | null;
  imageName: string | null;
  setReposTreeInfo: (info: ReposTreeInfo | ((prev: ReposTreeInfo) => ReposTreeInfo)) => void;
  setIsReposLoading: (isReposLoading: boolean) => void;
  setSelectedFile: (file: SelectedPathInfo | null) => void;
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
      imageSrc: null,
      imageName: null,
      setReposTreeInfo: (info) =>
        set((s) => ({ reposTreeInfo: typeof info === "function" ? info(s.reposTreeInfo) : info })),
      setIsReposLoading: (isReposLoading) => set({ isReposLoading }),
      setSelectedFile: (selectedFile) => set({ selectedFile }),
      reloadSelectedFile: () =>
        set((s) => ({ selectedFile: s.selectedFile ? { ...s.selectedFile } : null })),
      setImage: (imageSrc, imageName) => set({ imageSrc, imageName }),
      updateReposTreeInfo,
      reset: () => set({ reposTreeInfo: null, selectedFile: null, isReposLoading: false }),
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
authService.subscribe({ onLogout: () => useRepoStore.getState().reset() });

let loadRequest = 0;

/** Loads the selected file into the editor, or as an image; a newer request supersedes it. */
async function loadSelectedFile() {
  const request = ++loadRequest;
  const { selectedFile, setImage } = useRepoStore.getState();
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
    if (request === loadRequest) notifyUser(`Failed to load file: ${String(err)}`, "error");
  }
}

useRepoStore.subscribe((state, prev) => {
  if (state.selectedFile !== prev.selectedFile) void loadSelectedFile();
});
useSessionStore.subscribe((state, prev) => {
  if (state.isDeveloper !== prev.isDeveloper) void loadSelectedFile();
});

// The last opened file is restored once, when the repositories first load
const stopRestore = useRepoStore.subscribe((state) => {
  if (!state.reposTreeInfo?.length) return;
  stopRestore();
  const raw = localStorage.getItem(LAST_FILE_KEY);
  if (!raw) return;
  const last = JSON.parse(raw) as SelectedPathInfo;
  if (state.reposTreeInfo.some((r) => r.id === last.repo_id)) state.setSelectedFile(last);
});
