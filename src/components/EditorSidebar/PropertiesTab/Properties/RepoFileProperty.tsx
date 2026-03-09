// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useMemo, useState } from "react";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListItem,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import ImageIcon from "@mui/icons-material/Image";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CloseIcon from "@mui/icons-material/Close";
import type { PropertyKey, PropertyValue } from "@src/types/widgets";
import type { TreeNode } from "@src/services/APIClient";
import { useUIContext } from "@src/context/useUIContext";
import { toRelativeRepoPath } from "@src/utils/repoPath";

const IMAGE_EXTENSIONS = new Set([".svg", ".png", ".jpg", ".jpeg"]);

interface RepoFilePropertyProps {
  propName: PropertyKey;
  label: string;
  value: PropertyValue;
  category: string;
  /** Allowed file extensions, e.g. [".svg", ".png"]. Accepts all files when empty/undefined. */
  accept?: string[];
  onChange: (propName: PropertyKey, newValue: PropertyValue) => void;
}

function collectPaths(nodes: TreeNode[], accept: Set<string>, acc: string[] = []): string[] {
  for (const node of nodes) {
    if (node.type === "file") {
      const dot = node.path.lastIndexOf(".");
      const ext = dot !== -1 ? node.path.slice(dot).toLowerCase() : "";
      if (accept.size === 0 || accept.has(ext)) acc.push(node.path);
    } else if (node.children) {
      collectPaths(node.children, accept, acc);
    }
  }
  return acc;
}

function fileIcon(path: string): React.ReactElement {
  const dot = path.lastIndexOf(".");
  const ext = dot !== -1 ? path.slice(dot).toLowerCase() : "";
  return IMAGE_EXTENSIONS.has(ext) ? (
    <ImageIcon fontSize="small" />
  ) : (
    <InsertDriveFileIcon fontSize="small" />
  );
}

const RepoFileProperty: React.FC<RepoFilePropertyProps> = ({
  propName,
  label,
  value,
  accept,
  onChange,
}) => {
  const { reposTreeInfo, selectedFile } = useUIContext();
  const [open, setOpen] = useState(false);

  const acceptSet = useMemo(() => new Set(accept ?? []), [accept]);

  const filePaths = useMemo(() => {
    if (!reposTreeInfo || !selectedFile?.repo_id) return [];
    const repo = reposTreeInfo.find((r) => r.id === selectedFile.repo_id);
    if (!repo) return [];
    return collectPaths(repo.tree, acceptSet);
  }, [reposTreeInfo, selectedFile?.repo_id, acceptSet]);

  const dialogTitle = useMemo(() => {
    if (!accept?.length) return "Select file";
    const allImages = accept.every((e) => IMAGE_EXTENSIONS.has(e));
    return allImages ? "Select image" : "Select file";
  }, [accept]);

  const tooltipTitle = useMemo(() => {
    if (!accept?.length) return "Browse repo files";
    const allImages = accept.every((e) => IMAGE_EXTENSIONS.has(e));
    return allImages ? "Browse repo images" : "Browse repo files";
  }, [accept]);

  const handlePick = (repoAbsPath: string) => {
    const opiPath = selectedFile?.path ?? "";
    const relative = opiPath ? toRelativeRepoPath(repoAbsPath, opiPath) : repoAbsPath;
    onChange(propName, relative);
    setOpen(false);
  };

  return (
    <ListItem disablePadding sx={{ px: 2, py: 1, display: "flex", flexBasis: "100%", flexGrow: 1 }}>
      <TextField
        fullWidth
        label={label}
        variant="outlined"
        size="small"
        value={value as string}
        onChange={(e) => onChange(propName, e.target.value)}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title={tooltipTitle}>
                  <span>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => setOpen(true)}
                      disabled={!filePaths.length}
                    >
                      <FolderOpenIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </InputAdornment>
            ),
          },
        }}
      />

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle
          sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}
        >
          <Typography variant="subtitle1">{dialogTitle}</Typography>
          <IconButton size="small" onClick={() => setOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {filePaths.length === 0 ? (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                No matching files found in this repository.
              </Typography>
            </Box>
          ) : (
            <List dense disablePadding>
              {filePaths.map((p) => (
                <ListItemButton key={p} onClick={() => handlePick(p)}>
                  <ListItemIcon sx={{ minWidth: 32 }}>{fileIcon(p)}</ListItemIcon>
                  <ListItemText
                    primary={p.slice(p.lastIndexOf("/") + 1)}
                    secondary={p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : undefined}
                    primaryTypographyProps={{ variant: "body2" }}
                    secondaryTypographyProps={{ variant: "caption" }}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>
    </ListItem>
  );
};

export default React.memo(RepoFileProperty);
