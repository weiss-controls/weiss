// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { notifyUser } from "@src/services/Notifications/Notification";
import {
  getAllDeployedReposTree,
  getAllReposTree,
  type DeploymentTreeInfo,
  type StagingTreeInfo,
} from "@src/services/APIClient";
import { useSessionStore } from "./sessionStore";

export interface SelectedPathInfo {
  repo_id: string;
  path: string;
}

type ReposTreeInfo = (StagingTreeInfo | DeploymentTreeInfo)[] | null;

interface RepoStoreState {
  reposTreeInfo: ReposTreeInfo;
  isReposLoading: boolean;
  /** File open in the editor (or shown as an image); loaded by AppEffects when it changes */
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
      updateReposTreeInfo: async () => {
        const { isAuthenticated, isDeveloper } = useSessionStore.getState();
        if (!isAuthenticated) return;
        set({ isReposLoading: true });
        try {
          const response = isDeveloper ? await getAllReposTree() : await getAllDeployedReposTree();
          set({ reposTreeInfo: response.data.length > 0 ? response.data : null });
        } catch (error) {
          notifyUser(`Failed to fetch repositories: ${String(error)}`, "error");
        } finally {
          set({ isReposLoading: false });
        }
      },
      reset: () => set({ reposTreeInfo: null, selectedFile: null, isReposLoading: false }),
    }),
    { name: "repoStore", enabled: import.meta.env.DEV },
  ),
);
