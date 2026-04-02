// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  Paper,
  Chip,
  Select,
  MenuItem,
  Divider,
  IconButton,
  Menu,
  Tooltip,
  Collapse,
} from "@mui/material";
import { RichTreeView } from "@mui/x-tree-view";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import RemoveCircleIcon from "@mui/icons-material/RemoveCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import CommitIcon from "@mui/icons-material/Commit";
import SyncIcon from "@mui/icons-material/Sync";
import RestoreIcon from "@mui/icons-material/Restore";
import FolderIcon from "@mui/icons-material/Folder";
import { useRichTreeViewApiRef } from "@mui/x-tree-view/hooks";
import {
  checkoutRepoRef,
  deployRepo,
  moveStagingRepoPath,
  renameStagingRepoPath,
  syncRepo,
  resetStagingRepo,
  undeployRepo,
  unregisterRepo,
  type GitFileStatus,
  type StagingTreeInfo,
  type TreeNode,
  type DeploymentTreeInfo,
} from "@src/services/APIClient";
import CustomGitIcon from "@src/components/CustomIcons/GitIcon";
import CustomTreeItem, {
  DragDropProvider,
  type DragDropCtx,
  type RichTreeItem,
} from "./ProjectTreeItem";
import { notifyUser } from "@src/services/Notifications/Notification";
import FileToolbar from "./FileToolbar";
import { useUIContext } from "@src/context/useUIContext";
import GitCommitDialog from "@src/components/GitCommitDialog/GitCommitDialog";
import { confirmDialog } from "@src/services/Dialog/Dialog";
import { COLORS } from "@src/constants/constants";

const IMAGE_EXTENSIONS = new Set([".svg", ".png", ".jpg", ".jpeg"]);
const isImageFile = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot !== -1 && IMAGE_EXTENSIONS.has(name.slice(dot).toLowerCase());
};

const hasDirtyDescendant = (children?: RichTreeItem[]): boolean =>
  !!children?.some((c) => c.gitStatus ?? hasDirtyDescendant(c.children));

export interface ProjectSectionProps {
  repo: StagingTreeInfo | DeploymentTreeInfo;
  onFileSelect: (repo_id: string, path: string) => void;
  onRepoUpdate: (update: StagingTreeInfo | DeploymentTreeInfo) => void;
  onTreeUpdate: (update: StagingTreeInfo[] | DeploymentTreeInfo[]) => void;
  defaultSelectedPath?: string;
}

export default function ProjectSection({
  repo,
  onFileSelect,
  onRepoUpdate,
  onTreeUpdate,
  defaultSelectedPath,
}: ProjectSectionProps) {
  const REF_MAX_DISPLAY_SIZE = 7;
  const { isDeveloper, inEditMode, selectedFile, setSelectedFile, setIsReposLoading, tokenStatus } =
    useUIContext();
  // helper for type checking
  const isStagingTree = useCallback(
    (repo: StagingTreeInfo | DeploymentTreeInfo): repo is StagingTreeInfo => {
      return isDeveloper && "working_tree_status" in repo;
    },
    [isDeveloper],
  );
  const [sectionExpanded, setSectionExpanded] = useState(true);
  const [gitCommitOpen, setGitCommitOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(menuAnchor);
  const apiRef = useRichTreeViewApiRef();
  const revertingLabelRef = useRef(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const selectedRef = isStagingTree(repo) ? repo.checked_out_ref : repo.deployed_ref;
  const shortRef = (ref: string) => ref.substring(0, REF_MAX_DISPLAY_SIZE);

  useEffect(() => {
    if (!defaultSelectedPath) return;
    setSelectedItem(defaultSelectedPath);
    const parts = defaultSelectedPath.split("/");
    const parents = parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"));
    setExpandedItems((prev) => {
      const missing = parents.filter((p) => !prev.includes(p));
      return missing.length > 0 ? [...prev, ...missing] : prev;
    });
  }, [defaultSelectedPath]);

  const expandAll = (repo: StagingTreeInfo | DeploymentTreeInfo) => {
    const allDirs: string[] = [];

    function walk(node: TreeNode) {
      if (node.type === "directory") {
        allDirs.push(node.path);
        node.children?.forEach(walk);
      }
    }
    repo.tree.forEach(walk);
    setExpandedItems(allDirs);
  };

  const collapseAll = () => setExpandedItems([]);

  const handleRefChange = async (ref: string) => {
    setIsReposLoading(true);
    try {
      const updatedTree = await checkoutRepoRef({
        path: { repo_id: repo.id },
        query: { ref },
      }).then((r) => r.data);
      onRepoUpdate(updatedTree);
      notifyUser(`Success: HEAD at ${shortRef(ref)}`, "success");
    } catch (err) {
      notifyUser(`Failed to checkout: ${err as string}`, "error");
    } finally {
      setIsReposLoading(false);
    }
  };

  const handleDeploy = async () => {
    const confirmed = await confirmDialog({
      title: `Deploy ${repo.alias}@${shortRef(selectedRef)}?`,
      message: "Confirming will make this version available to operators",
      confirmText: "Deploy",
      cancelText: "Cancel",
    });
    if (!confirmed) return;
    setIsReposLoading(true);
    try {
      const res = await deployRepo({
        body: { deployment_version: selectedRef },
        path: { repo_id: repo.id },
      }).then((r) => r.data);

      if (res.id !== repo.id || res.deployed_ref !== selectedRef) {
        throw new Error("Invalid deployment response");
      }
      repo.deployed_ref = res.deployed_ref;
      notifyUser(`Successfully deployed ${repo.alias}@${shortRef(selectedRef)}`, "success");
    } catch (err) {
      notifyUser(`Failed to deploy repo: ${err as string}`, "error");
    } finally {
      setIsReposLoading(false);
    }

    setMenuAnchor(null);
  };

  const handleUndeploy = async () => {
    if (selectedRef != repo.deployed_ref) return;
    const confirmed = await confirmDialog({
      title: `Undeploy ${repo.alias}@${shortRef(selectedRef)}?`,
      message: "Confirming will make this repository unavailable to operators",
      confirmText: "Undeploy",
      cancelText: "Cancel",
    });
    if (!confirmed) return;
    setIsReposLoading(true);
    try {
      const res = await undeployRepo({
        path: { repo_id: repo.id },
      });

      if (!res.response.ok) {
        const errorBody = await res.response.json().catch(() => null);
        const msg = errorBody?.detail ?? res.response.statusText;
        throw new Error(msg as string);
      }
      repo.deployed_ref = "";
      notifyUser(`Successfully undeployed ${repo.alias}`, "success");
    } catch (err) {
      notifyUser(`Failed to undeploy repo: ${err as string}`, "error");
    } finally {
      setIsReposLoading(false);
    }

    setMenuAnchor(null);
  };

  const handleUnregister = async () => {
    const confirmed = await confirmDialog({
      title: `Delete ${repo.alias}?`,
      message:
        "Confirming will undeploy if applicable and remove this repository from WEISS entirely",
      confirmText: "Delete",
      cancelText: "Cancel",
    });
    if (!confirmed) return;
    setIsReposLoading(true);
    try {
      const res = await unregisterRepo({
        path: { repo_id: repo.id },
      });

      if (!res.response.ok) {
        const errorBody = await res.response.json().catch(() => null);
        const msg = errorBody?.detail ?? res.response.statusText;
        throw new Error(msg as string);
      }
      if (selectedFile?.repo_id === repo.id) {
        setSelectedFile(null);
      }
      onTreeUpdate(res.data);
      notifyUser(`Successfully unregistered ${repo.alias}`, "success");
    } catch (err) {
      notifyUser(`Failed to unregister repo: ${err as string}`, "error");
    } finally {
      setIsReposLoading(false);
    }

    setMenuAnchor(null);
  };

  const handleSyncClick = async () => {
    setIsReposLoading(true);
    try {
      const updatedTree = await syncRepo({ path: { repo_id: repo.id } }).then((r) => r.data);
      onRepoUpdate(updatedTree);
      notifyUser(`Successfully updated ${repo.alias}`, "success");
    } catch (err) {
      notifyUser(`Failed to update ${repo.alias}: ${err as string}`, "error");
    } finally {
      setIsReposLoading(false);
    }
  };

  const handleResetClick = async () => {
    setIsReposLoading(true);
    try {
      const updatedTree = await resetStagingRepo({ path: { repo_id: repo.id } }).then(
        (r) => r.data,
      );
      onRepoUpdate(updatedTree);
      notifyUser(`Successfully restored ${repo.alias}`, "success");
    } catch (err) {
      notifyUser(`Failed to restore ${repo.alias}: ${err as string}`, "error");
    } finally {
      setIsReposLoading(false);
    }
  };

  const handleItemLabelChange = async (itemId: string, newLabel: string) => {
    if (!isStagingTree(repo)) return;

    if (revertingLabelRef.current) {
      revertingLabelRef.current = false;
      return;
    }

    const oldLabel = itemId.slice(itemId.lastIndexOf("/") + 1);
    const revertLabel = () => {
      revertingLabelRef.current = true;
      apiRef.current?.updateItemLabel(itemId, oldLabel);
    };

    try {
      const updt = await renameStagingRepoPath({
        path: { repo_id: repo.id },
        query: { path: itemId },
        body: { new_name: newLabel },
      }).then((r) => r.data);
      if (selectedFile?.repo_id === repo.id) {
        const parentDir = itemId.slice(0, itemId.lastIndexOf("/") + 1);
        const newItemPath = parentDir + newLabel;
        if (selectedFile.path === itemId) {
          setSelectedFile({ ...selectedFile, path: newItemPath });
        } else if (selectedFile.path.startsWith(itemId + "/")) {
          setSelectedFile({
            ...selectedFile,
            path: newItemPath + selectedFile.path.slice(itemId.length),
          });
        }
      }
      onRepoUpdate(updt);
    } catch (err) {
      revertLabel();
      notifyUser(`Failed to rename: ${err as string}`, "error");
    }
  };

  const handleMoveDrop = async (targetDirId: string) => {
    const srcId = draggedItemId;
    setDraggedItemId(null);
    setDropTargetId(null);
    if (!srcId || !isStagingTree(repo)) return;
    const srcParent = srcId.includes("/") ? srcId.slice(0, srcId.lastIndexOf("/")) : "";
    if (srcParent === targetDirId || srcId === targetDirId) return;
    if (targetDirId.startsWith(srcId + "/")) return;
    try {
      const updt = await moveStagingRepoPath({
        path: { repo_id: repo.id },
        query: { path: srcId },
        body: { destination: targetDirId },
      }).then((r) => r.data);
      if (selectedFile?.repo_id === repo.id) {
        const itemName = srcId.slice(srcId.lastIndexOf("/") + 1);
        const newPath = targetDirId ? `${targetDirId}/${itemName}` : itemName;
        if (selectedFile.path === srcId) {
          setSelectedFile({ ...selectedFile, path: newPath });
        } else if (selectedFile.path.startsWith(`${srcId}/`)) {
          setSelectedFile({
            ...selectedFile,
            path: newPath + selectedFile.path.slice(srcId.length),
          });
        }
      }
      onRepoUpdate(updt);
    } catch (err) {
      notifyUser(`Failed to move: ${err as string}`, "error");
    }
  };

  const findItemById = useCallback((items: RichTreeItem[], id: string): RichTreeItem | null => {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findItemById(item.children, id);
        if (found) return found;
      }
    }
    return null;
  }, []);

  const gitStatusByPath = useMemo(() => {
    if (!isStagingTree(repo)) return;
    const map = new Map<string, GitFileStatus["status"]>();

    repo.working_tree_status?.files.forEach((f) => {
      map.set(f.path, f.status);
    });

    return map;
  }, [repo, isStagingTree]);

  // convert TreeNode[] to RichTree accepted format
  const toRichItems = useCallback(
    (nodes: TreeNode[]): RichTreeItem[] => {
      return nodes
        .filter((node) => {
          if (inEditMode) return true;
          // files or folders starting with _ are not shown in runtime
          if (node.name.startsWith("_")) return false;
          // image files are not shown in runtime
          if (node.type === "file" && isImageFile(node.name)) return false;
          return true;
        })
        .map((node) => {
          const children = node.children ? toRichItems(node.children) : undefined;
          const fileStatus = gitStatusByPath?.get(node.path);
          const isDirectory = node.type === "directory";
          // mark directory as dirty if any child is dirty or if a deleted file exists under this path
          let dirDirty = false;
          if (isStagingTree(repo) && isDirectory) {
            const hasDirtyChildren = hasDirtyDescendant(children);
            const hasDeletedDescendant =
              repo.working_tree_status?.files.some(
                (f) => f.status === "deleted" && f.path.startsWith(node.path + "/"),
              ) ?? false;
            dirDirty = hasDirtyChildren || hasDeletedDescendant;
          }

          return {
            id: node.path,
            label: node.name,
            type: node.type,
            path: node.path,
            gitStatus: fileStatus ?? (dirDirty ? "modified" : undefined),
            children,
          };
        });
    },
    [isStagingTree, repo, gitStatusByPath, inEditMode],
  );

  const items = useMemo(() => toRichItems(repo.tree), [repo.tree, toRichItems]);

  if (!selectedRef) return;

  const dndEnabled = isStagingTree(repo) && isDeveloper && inEditMode;
  const dndContextValue: DragDropCtx = {
    enabled: dndEnabled,
    draggedItemId,
    dropTargetId,
    onDragStart: (id) => {
      setDraggedItemId(id);
    },
    onDragEnd: () => {
      setDraggedItemId(null);
      setDropTargetId(null);
    },
    onDragEnterDir: (id) => setDropTargetId(id),
    onDragLeaveDir: (id) => setDropTargetId((prev) => (prev === id ? null : prev)),
    onDrop: (targetDirId) => {
      void handleMoveDrop(targetDirId);
    },
  };

  return (
    <Paper variant="outlined" sx={{ mb: 2, width: "100%" }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
        <IconButton size="small" onClick={() => setSectionExpanded((v) => !v)}>
          {sectionExpanded ? (
            <ExpandLessIcon fontSize="small" />
          ) : (
            <ExpandMoreIcon fontSize="small" />
          )}
        </IconButton>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Tooltip title={repo.alias}>
            <Typography variant="subtitle2" noWrap sx={{ fontWeight: 500 }}>
              {repo.alias}
            </Typography>
          </Tooltip>
        </Box>

        {!isStagingTree(repo) && repo.deployed_ref && (
          <Chip icon={<CustomGitIcon />} size="small" label={shortRef(repo.deployed_ref)} />
        )}

        {isStagingTree(repo) && (
          <>
            <CustomGitIcon fontSize="small" />
            <Tooltip
              placement="top"
              title={`Checked-out ref${repo.working_tree_status?.dirty ? " (Dirty)" : ""}`}
            >
              <Select
                size="small"
                value={selectedRef}
                onChange={(e) => void handleRefChange(e.target.value)}
                renderValue={(value) => shortRef(value)}
                sx={{
                  minWidth: 14 * REF_MAX_DISPLAY_SIZE,
                  maxWidth: 14 * REF_MAX_DISPLAY_SIZE,
                  fontSize: "0.75rem",
                }}
              >
                {repo.refs?.map((ref) => (
                  <MenuItem
                    key={ref}
                    value={ref}
                    sx={{ color: ref === repo.deployed_ref ? "green" : undefined }}
                  >
                    <Box display="flex" flexDirection="column">
                      <Typography variant="inherit">{shortRef(ref)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {ref === repo.deployed_ref ? "Deployed" : null}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </Tooltip>

            <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <MoreVertIcon fontSize="small" />
            </IconButton>

            <Menu anchorEl={menuAnchor} open={menuOpen} onClose={() => setMenuAnchor(null)}>
              <Tooltip
                placement="top"
                title={
                  tokenStatus?.valid === false
                    ? tokenStatus.detail
                    : "Commit and push current changes"
                }
              >
                <span>
                  <MenuItem
                    onClick={() => setGitCommitOpen(true)}
                    disabled={tokenStatus?.valid === false}
                  >
                    <CommitIcon fontSize="small" sx={{ mr: 1 }} />
                    Commit
                  </MenuItem>
                </span>
              </Tooltip>
              <Tooltip placement="top" title="Sync repo with remote (fetch)">
                <MenuItem onClick={() => void handleSyncClick()}>
                  <SyncIcon fontSize="small" sx={{ mr: 1 }} />
                  Sync
                </MenuItem>
              </Tooltip>
              {repo.deployed_ref == selectedRef ? (
                <Tooltip placement="top" title="Undeploy this revision">
                  <MenuItem onClick={() => void handleUndeploy()} disabled={!selectedRef}>
                    <RemoveCircleIcon fontSize="small" sx={{ mr: 1 }} />
                    Undeploy
                  </MenuItem>
                </Tooltip>
              ) : (
                <Tooltip placement="top" title="Deploy this revision to operators">
                  <MenuItem onClick={() => void handleDeploy()} disabled={!selectedRef}>
                    <CloudUploadIcon fontSize="small" sx={{ mr: 1 }} />
                    Deploy
                  </MenuItem>
                </Tooltip>
              )}
              <Tooltip placement="top" title="Discard all uncommited changes">
                <MenuItem onClick={() => void handleResetClick()}>
                  <RestoreIcon fontSize="small" sx={{ mr: 1 }} />
                  Discard changes
                </MenuItem>
              </Tooltip>
              <Tooltip placement="top" title="Delete this repository">
                <MenuItem onClick={() => void handleUnregister()}>
                  <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
                  Delete
                </MenuItem>
              </Tooltip>
            </Menu>
          </>
        )}
      </Box>
      <Divider />
      {/* Repo content */}
      <Collapse in={sectionExpanded} timeout="auto" unmountOnExit>
        <FileToolbar
          repoId={repo.id}
          selectedPath={selectedItem !== null ? { repo_id: repo.id, path: selectedItem } : null}
          onRepoUpdate={onRepoUpdate}
          onExpandAll={() => expandAll(repo)}
          onCollapseAll={() => collapseAll()}
          onStartRename={() => {
            if (selectedItem) apiRef.current?.setEditedItem(selectedItem);
          }}
        />
        <DragDropProvider value={dndContextValue}>
          <Box sx={{ px: 1, py: 0.5 }}>
            {isStagingTree(repo) && isDeveloper && inEditMode && (
              <Box
                onClick={() => setSelectedItem("")}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  const ct = e.currentTarget as HTMLElement;
                  const rt = e.relatedTarget as Node | null;
                  if (!rt || !ct.contains(rt)) setDropTargetId("");
                }}
                onDragLeave={(e) => {
                  const ct = e.currentTarget as HTMLElement;
                  const rt = e.relatedTarget as Node | null;
                  if (!rt || !ct.contains(rt))
                    setDropTargetId((prev) => (prev === "" ? null : prev));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  void handleMoveDrop("");
                }}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  px: 0.5,
                  py: 0.25,
                  mb: 0.25,
                  borderRadius: 1,
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  backgroundColor: selectedItem === "" ? "action.selected" : undefined,
                  outline: dropTargetId === "" ? `2px solid ${COLORS.highlighted}` : undefined,
                  "&:hover": { backgroundColor: "action.hover" },
                }}
              >
                <FolderIcon sx={{ fontSize: 18, color: COLORS.midGray }} />
                <Box component="span" sx={{ color: "text.secondary", fontStyle: "italic" }}>
                  / (root)
                </Box>
              </Box>
            )}
            <RichTreeView
              items={items}
              selectedItems={selectedItem}
              onSelectedItemsChange={(_, id) => {
                setSelectedItem(id);
                const item = id ? findItemById(items, id) : null;
                if (item?.type === "file") void onFileSelect(repo.id, item.path);
              }}
              expandedItems={expandedItems}
              onExpandedItemsChange={(_, ids) => setExpandedItems(ids)}
              slots={{ item: CustomTreeItem }}
              apiRef={apiRef}
              isItemEditable={isStagingTree(repo) && isDeveloper && inEditMode ? true : false}
              onItemLabelChange={(itemId, newLabel) => void handleItemLabelChange(itemId, newLabel)}
            />
          </Box>
        </DragDropProvider>
      </Collapse>
      <GitCommitDialog
        open={gitCommitOpen}
        onClose={() => setGitCommitOpen(false)}
        repoID={repo.id}
      />
    </Paper>
  );
}
