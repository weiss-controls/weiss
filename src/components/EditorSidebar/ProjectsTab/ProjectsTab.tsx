// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getDeployedRepoFile,
  getStagingRepoFile,
  type DeploymentTreeInfo,
  type StagingTreeInfo,
} from "@src/services/APIClient";
import ProjectSection from "./ProjectSection";
import { Box, Button } from "@mui/material";
import type { SelectedPathInfo } from "@src/context/useUIManager";
import GitImportDialog from "@src/components/GitImportDialog/GitImportDialog";
import CustomGitIcon from "@src/components/CustomIcons/GitIcon";
import { COLORS } from "@src/constants/constants";
import { useUIContext } from "@src/context/useUIContext";
import { useWidgetContext } from "@src/context/useWidgetContext";

export default function ProjectsTab() {
  const { loadWidgets } = useWidgetContext();
  const {
    isDeveloper,
    reposTreeInfo,
    setReposTreeInfo,
    updateReposTreeInfo,
    inEditMode,
    setSelectedFile,
    selectedFile,
  } = useUIContext();
  const restoredRef = useRef(false);
  const [initialSelection, setInitialSelection] = useState<SelectedPathInfo | null>(null);
  const [GitImportOpen, setGitImportOpen] = useState(false);

  useEffect(() => {
    void updateReposTreeInfo();
  }, [updateReposTreeInfo]);

  const refreshRepoTree = (updt: StagingTreeInfo | DeploymentTreeInfo) => {
    setReposTreeInfo((prev) => (prev ? prev.map((r) => (updt.id === r.id ? updt : r)) : prev));
    // update opened file if it belongs to synced repo
    if (selectedFile?.repo_id === updt.id) {
      void loadRepoFile(selectedFile.repo_id, selectedFile.path);
    }
  };

  const refreshAllReposTree = (updt: StagingTreeInfo[] | DeploymentTreeInfo[]) => {
    setReposTreeInfo(updt);
  };

  const loadRepoFile = useCallback(
    async (repo_id: string, path: string, opts: { persist?: boolean } = { persist: true }) => {
      const res = isDeveloper
        ? await getStagingRepoFile({ path: { repo_id }, query: { path } })
        : await getDeployedRepoFile({ path: { repo_id }, query: { path } });

      loadWidgets(res.data.content);
      setSelectedFile({ repo_id, path });

      if (opts.persist) {
        localStorage.setItem("lastLoadedFile", JSON.stringify({ repo_id, path }));
      }
    },
    [isDeveloper, loadWidgets, setSelectedFile],
  );

  // On first render, restore last loaded file
  useEffect(() => {
    if (restoredRef.current || !reposTreeInfo?.length) return;

    const raw = localStorage.getItem("lastLoadedFile");
    if (!raw) {
      restoredRef.current = true;
      return;
    }

    const parsed = JSON.parse(raw) as SelectedPathInfo;
    const repo = reposTreeInfo.find((r) => r.id === parsed.repo_id);
    if (!repo) {
      restoredRef.current = true;
      return;
    }

    setInitialSelection(parsed);
    // trigger file load once
    void loadRepoFile(parsed.repo_id, parsed.path, { persist: false });
    restoredRef.current = true;
  }, [reposTreeInfo, loadRepoFile]);

  return (
    <Box
      sx={{
        mx: 2,
        my: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {reposTreeInfo?.length ? (
        reposTreeInfo.map((repo) => (
          <ProjectSection
            key={repo.id}
            repo={repo}
            onFileSelect={loadRepoFile}
            onRepoUpdate={refreshRepoTree}
            onTreeUpdate={refreshAllReposTree}
            defaultSelectedPath={
              initialSelection?.repo_id === repo.id ? initialSelection.path : undefined
            }
          />
        ))
      ) : (
        <Box sx={{ p: 2 }}>{`No repositories ${isDeveloper ? "available" : "deployed"}`}</Box>
      )}
      {inEditMode && isDeveloper && (
        <Button
          variant="contained"
          onClick={() => setGitImportOpen(true)}
          startIcon={<CustomGitIcon />}
          sx={{
            backgroundColor: COLORS.titleBarColor,
            textTransform: "none",
            "&:hover": { backgroundColor: COLORS.midDarkBlue },
          }}
        >
          Import new repository
        </Button>
      )}
      <GitImportDialog open={GitImportOpen} onClose={() => setGitImportOpen(false)} />
    </Box>
  );
}
