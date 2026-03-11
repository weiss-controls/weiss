// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  ListItem,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import FolderIcon from "@mui/icons-material/Folder";
import FileUploadOutlined from "@mui/icons-material/FileUploadOutlined";
import ImageIcon from "@mui/icons-material/Image";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CloseIcon from "@mui/icons-material/Close";
import UnfoldLessOutlined from "@mui/icons-material/UnfoldLessOutlined";
import UnfoldMoreOutlined from "@mui/icons-material/UnfoldMoreOutlined";
import type { PropertyKey, PropertyValue } from "@src/types/widgets";
import {
  type StagingTreeInfo,
  type TreeNode,
  uploadStagingRepoFile,
} from "@src/services/APIClient";
import { useUIContext } from "@src/context/useUIContext";
import { notifyUser } from "@src/services/Notifications/Notification";
import { toRelativeRepoPath, resolveRepoPath } from "@src/utils/repoPath";

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

/** True if the subtree rooted at `node` contains at least one accepted file. */
function hasAcceptedFile(node: TreeNode, accept: Set<string>): boolean {
  if (node.type === "file") {
    if (accept.size === 0) return true;
    const dot = node.path.lastIndexOf(".");
    const ext = dot !== -1 ? node.path.slice(dot).toLowerCase() : "";
    return accept.has(ext);
  }
  return !!node.children?.some((c) => hasAcceptedFile(c, accept));
}

/** Collect all parent directory paths for a given repo-absolute file path. */
function parentPaths(absPath: string): string[] {
  const parts = absPath.split("/");
  if (parts.length <= 1) return [];
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"));
}

function getParentDir(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx > 0 ? path.slice(0, idx) : "";
}

function isFilePath(path: string): boolean {
  const lastSegment = path.slice(path.lastIndexOf("/") + 1);
  return lastSegment.includes(".");
}

function getCreateBasePath(path: string): string {
  return isFilePath(path) ? getParentDir(path) : path;
}

function fileIcon(path: string): React.ReactElement {
  const dot = path.lastIndexOf(".");
  const ext = dot !== -1 ? path.slice(dot).toLowerCase() : "";
  return IMAGE_EXTENSIONS.has(ext) ? (
    <ImageIcon fontSize="small" color="action" />
  ) : (
    <InsertDriveFileIcon fontSize="small" color="action" />
  );
}

const RepoFileProperty: React.FC<RepoFilePropertyProps> = ({
  propName,
  label,
  value,
  accept,
  onChange,
}) => {
  const { reposTreeInfo, selectedFile, setReposTreeInfo, inEditMode, isDeveloper } = useUIContext();
  const [open, setOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const opiPath = selectedFile?.path ?? "";
  const acceptSet = useMemo(() => new Set(accept ?? []), [accept]);

  const repoTree = useMemo(() => {
    if (!reposTreeInfo || !selectedFile?.repo_id) return null;
    return reposTreeInfo.find((r) => r.id === selectedFile.repo_id)?.tree ?? null;
  }, [reposTreeInfo, selectedFile?.repo_id]);

  const hasFiles = useMemo(
    () => repoTree?.some((n) => hasAcceptedFile(n, acceptSet)) ?? false,
    [repoTree, acceptSet],
  );

  // Collect accepted file paths as a Set for O(1) lookup in onItemClick.
  const filePathSet = useMemo(() => {
    const set = new Set<string>();
    function walk(nodes: TreeNode[]) {
      for (const node of nodes) {
        if (node.type === "file" && hasAcceptedFile(node, acceptSet)) set.add(node.path);
        else if (node.children) walk(node.children);
      }
    }
    if (repoTree) walk(repoTree);
    return set;
  }, [repoTree, acceptSet]);

  const allDirectoryPaths = useMemo(() => {
    const directories: string[] = [];

    function walk(nodes: TreeNode[]) {
      for (const node of nodes) {
        if (node.type !== "directory") continue;
        directories.push(node.path);
        if (node.children) walk(node.children);
      }
    }

    if (repoTree) walk(repoTree);
    return directories;
  }, [repoTree]);

  // Stable refs so the effect can read current values without being re-triggered.
  const valueRef = useRef(value);
  const opiPathRef = useRef(opiPath);
  valueRef.current = value;
  opiPathRef.current = opiPath;

  // Pre-expand to the current value's directory (or OPI dir) when the dialog opens.
  useEffect(() => {
    if (!open) return;
    const currentAbs =
      valueRef.current && typeof valueRef.current === "string"
        ? resolveRepoPath(valueRef.current, opiPathRef.current)
        : opiPathRef.current;
    setExpandedItems(parentPaths(currentAbs));
  }, [open]);

  const selectedAbsPath = useMemo(
    () => (value && typeof value === "string" ? resolveRepoPath(value, opiPath) : undefined),
    [value, opiPath],
  );

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

  const handlePick = (absPath: string) => {
    const relative = opiPath ? toRelativeRepoPath(absPath, opiPath) : `./${absPath}`;
    onChange(propName, relative);
    setOpen(false);
  };

  const handleUpload = async (file: File) => {
    if (!selectedFile?.repo_id) return;

    const basePath = getCreateBasePath(selectedFile.path);
    const destPath = basePath ? `${basePath}/${file.name}` : file.name;

    try {
      const updatedTree = await uploadStagingRepoFile({
        path: { repo_id: selectedFile.repo_id },
        query: { path: destPath },
        body: { file },
      }).then((response) => response.data);

      setReposTreeInfo((prev) =>
        prev
          ? prev.map((repo) =>
              repo.id === updatedTree.id ? (updatedTree as StagingTreeInfo) : repo,
            )
          : prev,
      );
    } catch (err) {
      notifyUser(`Failed to upload file: ${err as string}`, "error");
    }
  };

  function renderNodes(nodes: TreeNode[]): React.ReactNode {
    return nodes.map((node) => {
      if (node.type === "file") {
        if (acceptSet.size > 0) {
          const dot = node.path.lastIndexOf(".");
          const ext = dot !== -1 ? node.path.slice(dot).toLowerCase() : "";
          if (!acceptSet.has(ext)) return null;
        }
        return (
          <TreeItem
            key={node.path}
            itemId={node.path}
            sx={{ cursor: "pointer" }}
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, py: 0.25 }}>
                {fileIcon(node.path)}
                <Typography variant="body2">{node.name}</Typography>
              </Box>
            }
          />
        );
      }
      return (
        <TreeItem
          key={node.path}
          itemId={node.path}
          label={
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, py: 0.25 }}>
              <FolderIcon fontSize="small" color="action" />
              <Typography variant="body2">{node.name}</Typography>
            </Box>
          }
        >
          {node.children && renderNodes(node.children)}
        </TreeItem>
      );
    });
  }

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
                      disabled={!hasFiles}
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
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              width: "100%",
            }}
          >
            <Typography variant="subtitle1">{dialogTitle}</Typography>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {isDeveloper && inEditMode && (
                <>
                  <Tooltip title="Upload file">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!selectedFile?.repo_id}
                      >
                        <FileUploadOutlined fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={accept?.length ? accept.join(",") : undefined}
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      void handleUpload(file);
                    }}
                  />
                </>
              )}
              <Tooltip title="Expand all">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => setExpandedItems(allDirectoryPaths)}
                    disabled={!repoTree?.length}
                  >
                    <UnfoldMoreOutlined fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Collapse all">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => setExpandedItems([])}
                    disabled={!expandedItems.length}
                  >
                    <UnfoldLessOutlined fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <IconButton size="small" onClick={() => setOpen(false)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 1 }}>
          {!repoTree || !hasFiles ? (
            <Box sx={{ p: 1 }}>
              <Typography variant="body2" color="text.secondary">
                No matching files found in this repository.
              </Typography>
            </Box>
          ) : (
            <SimpleTreeView
              expandedItems={expandedItems}
              onExpandedItemsChange={(_, items) => setExpandedItems(items)}
              selectedItems={selectedAbsPath ?? null}
              onItemClick={(_, itemId) => {
                if (filePathSet.has(itemId)) handlePick(itemId);
              }}
            >
              {renderNodes(repoTree)}
            </SimpleTreeView>
          )}
        </DialogContent>
      </Dialog>
    </ListItem>
  );
};

export default React.memo(RepoFileProperty);
