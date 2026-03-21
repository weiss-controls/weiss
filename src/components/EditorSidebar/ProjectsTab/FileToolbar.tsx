// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { useRef } from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import {
  CreateNewFolderOutlined,
  DeleteOutlined,
  DriveFileRenameOutlineOutlined,
  NoteAddOutlined,
  UnfoldLessOutlined,
  UnfoldMoreOutlined,
  FileUploadOutlined,
} from "@mui/icons-material";
import {
  createStagingRepoPath,
  deleteStagingRepoPath,
  uploadStagingRepoFile,
  type StagingTreeInfo,
} from "@src/services/APIClient";
import { notifyUser } from "@src/services/Notifications/Notification";
import type { SelectedPathInfo } from "@src/context/useUIManager";
import { confirmDialog } from "@src/services/Dialog/Dialog";
import { useUIContext } from "@src/context/useUIContext";

interface FileToolbarProps {
  selectedPath: SelectedPathInfo | null;
  onRepoUpdate: (update: StagingTreeInfo) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onStartRename: () => void;
}

function getParentDir(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx > 0 ? path.slice(0, idx) : "";
}

function isFilePath(path: string): boolean {
  const lastSegment = path.slice(path.lastIndexOf("/") + 1);
  return lastSegment.includes(".");
}

function getCreateBasePath(selected: SelectedPathInfo): string {
  return isFilePath(selected.path) ? getParentDir(selected.path) : selected.path;
}

function normalizeJsonFileName(name: string): string | null {
  const trimmed = name.trim();

  if (!trimmed) return null;

  const dotIdx = trimmed.lastIndexOf(".");
  if (dotIdx === -1) {
    return `${trimmed}.json`;
  }

  const ext = trimmed.slice(dotIdx).toLowerCase();
  if (ext !== ".json") {
    return null;
  }

  return trimmed;
}

const ALLOWED_UPLOAD_EXTENSIONS = [".svg", ".png", ".jpg", ".jpeg", ".json"];

export default function FileToolbar({
  selectedPath,
  onRepoUpdate,
  onExpandAll,
  onCollapseAll,
  onStartRename,
}: FileToolbarProps) {
  const iconSx = { fontSize: 18 };
  const { inEditMode, isDeveloper, selectedFile, setSelectedFile } = useUIContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function createPath(repo_id: string, path: string, type: "file" | "directory") {
    try {
      const updt = await createStagingRepoPath({
        path: { repo_id },
        body: { path, type },
      }).then((r) => r.data);
      onRepoUpdate(updt);
    } catch (err) {
      notifyUser(`Failed to create path: ${err as string}`, "error");
    }
  }

  async function uploadFile(repo_id: string, basePath: string, file: File) {
    const destPath = basePath ? `${basePath}/${file.name}` : file.name;
    try {
      const updt = await uploadStagingRepoFile({
        path: { repo_id },
        query: { path: destPath },
        body: { file },
      }).then((r) => r.data);
      onRepoUpdate(updt);
    } catch (err) {
      notifyUser(`Failed to upload file: ${err as string}`, "error");
    }
  }

  async function deletePath(repo_id: string, path: string) {
    const confirmed = await confirmDialog({
      title: `Delete ${selectedPath?.path}?`,
      message: "Confirming will remove this item",
      confirmText: "Delete",
      cancelText: "Cancel",
    });
    if (!confirmed) return;
    try {
      const updt = await deleteStagingRepoPath({
        path: { repo_id },
        query: { path },
      }).then((r) => r.data);
      if (selectedFile?.repo_id === repo_id) {
        setSelectedFile(null);
      }
      onRepoUpdate(updt);
    } catch {
      notifyUser("Failed to delete path", "error");
    }
  }

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      {isDeveloper && inEditMode && (
        <>
          <Tooltip title="Create new file">
            <IconButton
              onClick={() => {
                if (!selectedPath) return;
                const input = prompt("Enter new file name:");
                if (!input) return;
                const fileName = normalizeJsonFileName(input);
                if (!fileName) {
                  notifyUser(
                    "Only .json files are allowed. Either leave extension empty or use .json",
                    "error",
                  );
                  return;
                }
                const basePath = getCreateBasePath(selectedPath);
                void createPath(selectedPath.repo_id, `${basePath}/${fileName}`, "file");
              }}
            >
              <NoteAddOutlined sx={iconSx} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Create new folder">
            <IconButton
              onClick={() => {
                if (!selectedPath) return;
                const name = prompt("Enter new folder name:");
                if (!name) return;
                const basePath = getCreateBasePath(selectedPath);
                void createPath(selectedPath.repo_id, `${basePath}/${name}`, "directory");
              }}
            >
              <CreateNewFolderOutlined sx={iconSx} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Upload file">
            <IconButton
              onClick={() => {
                if (!selectedPath) return;
                fileInputRef.current?.click();
              }}
            >
              <FileUploadOutlined sx={iconSx} />
            </IconButton>
          </Tooltip>

          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_UPLOAD_EXTENSIONS.join(",")}
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file || !selectedPath) return;
              const basePath = getCreateBasePath(selectedPath);
              void uploadFile(selectedPath.repo_id, basePath, file);
            }}
          />

          <Tooltip title="Rename selected path">
            <IconButton
              onClick={() => {
                if (!selectedPath) return;
                onStartRename();
              }}
            >
              <DriveFileRenameOutlineOutlined sx={iconSx} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Delete selected path">
            <IconButton
              onClick={() => {
                if (!selectedPath) return;
                void deletePath(selectedPath.repo_id, selectedPath.path);
              }}
            >
              <DeleteOutlined sx={iconSx} />
            </IconButton>
          </Tooltip>
        </>
      )}
      {/* Expand all */}
      <Tooltip title="Expand all">
        <IconButton onClick={onExpandAll}>
          <UnfoldMoreOutlined sx={iconSx} />
        </IconButton>
      </Tooltip>

      {/* Collapse all */}
      <Tooltip title="Collapse all">
        <IconButton onClick={onCollapseAll}>
          <UnfoldLessOutlined sx={iconSx} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
