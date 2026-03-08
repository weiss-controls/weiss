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
import { Box, Button, Paper, Skeleton, Typography } from "@mui/material";
import type { SelectedPathInfo } from "@src/context/useUIManager";
import GitImportDialog from "@src/components/GitImportDialog/GitImportDialog";
import CustomGitIcon from "@src/components/CustomIcons/GitIcon";
import { COLORS } from "@src/constants/constants";
import { useUIContext } from "@src/context/useUIContext";
import { useWidgetContext } from "@src/context/useWidgetContext";

const IMAGE_EXTENSIONS = new Set([".svg", ".png", ".jpg", ".jpeg"]);
const isImageFile = (path: string) => {
  const dot = path.lastIndexOf(".");
  return dot !== -1 && IMAGE_EXTENSIONS.has(path.slice(dot).toLowerCase());
};

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

export default function ProjectsTab() {
  const { loadWidgets } = useWidgetContext();
  const {
    isDeveloper,
    reposTreeInfo,
    setReposTreeInfo,
    isReposLoading,
    inEditMode,
    setSelectedFile,
    selectedFile,
  } = useUIContext();
  const restoredRef = useRef(false);
  const [initialSelection, setInitialSelection] = useState<SelectedPathInfo | null>(null);
  const [GitImportOpen, setGitImportOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);

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

      if (isImageFile(path)) {
        const { content, encoding } = res.data;
        setImageSrc(buildDataUrl(path, content, encoding ?? "utf-8"));
        setImageName(path.slice(path.lastIndexOf("/") + 1));
        // update context so other widgets in the same repo know which repo is active,
        // but don't populate the canvas with image content
        setSelectedFile({ repo_id, path });
        if (opts.persist) {
          localStorage.setItem("lastLoadedFile", JSON.stringify({ repo_id, path }));
        }
        return;
      }

      setImageSrc(null);
      setImageName(null);
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
      {isReposLoading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <Box key={i} sx={{ width: "100%", mb: 1 }}>
            <Skeleton variant="rounded" height={36} sx={{ mb: 0.5 }} />
            <Skeleton variant="text" sx={{ mx: 1 }} />
            <Skeleton variant="text" sx={{ mx: 1 }} />
          </Box>
        ))
      ) : reposTreeInfo?.length ? (
        <>
          {imageSrc && (
            <Paper variant="outlined" sx={{ width: "100%", mb: 2, p: 1, boxSizing: "border-box" }}>
              <Typography
                variant="caption"
                noWrap
                display="block"
                sx={{ mb: 0.5, color: "text.secondary" }}
              >
                {imageName}
              </Typography>
              <Box
                component="img"
                src={imageSrc}
                alt={imageName ?? ""}
                sx={{ width: "100%", maxHeight: 200, objectFit: "contain", display: "block" }}
              />
            </Paper>
          )}
          {reposTreeInfo.map((repo) => (
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
          ))}
        </>
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
