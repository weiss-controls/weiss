// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { useState } from "react";
import { type DeploymentTreeInfo, type StagingTreeInfo } from "@src/services/APIClient";
import ProjectSection from "./ProjectSection";
import { Box, Button, Paper, Skeleton, Typography } from "@mui/material";
import GitImportDialog from "@src/components/GitImportDialog/GitImportDialog";
import CustomGitIcon from "@src/components/CustomIcons/GitIcon";
import { COLORS } from "@src/constants/constants";
import { useUIContext } from "@src/context/useUIContext";

export default function ProjectsTab() {
  const {
    isDeveloper,
    reposTreeInfo,
    setReposTreeInfo,
    isReposLoading,
    inEditMode,
    setSelectedFile,
    selectedFile,
    imageSrc,
    imageName,
    reloadSelectedFile,
  } = useUIContext();
  const [GitImportOpen, setGitImportOpen] = useState(false);

  const refreshRepoTree = (updt: StagingTreeInfo | DeploymentTreeInfo) => {
    setReposTreeInfo((prev) => (prev ? prev.map((r) => (updt.id === r.id ? updt : r)) : prev));
    if (selectedFile?.repo_id === updt.id) reloadSelectedFile();
  };

  const refreshAllReposTree = (updt: StagingTreeInfo[] | DeploymentTreeInfo[]) => {
    setReposTreeInfo(updt);
  };

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
              onFileSelect={(repo_id, path) => setSelectedFile({ repo_id, path })}
              onRepoUpdate={refreshRepoTree}
              onTreeUpdate={refreshAllReposTree}
              defaultSelectedPath={
                selectedFile?.repo_id === repo.id ? selectedFile.path : undefined
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
