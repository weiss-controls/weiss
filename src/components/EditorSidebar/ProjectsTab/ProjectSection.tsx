import { useCallback, useMemo, useState, useEffect, forwardRef } from "react";
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
import { RichTreeView, type TreeViewBaseItem, TreeItemLabel, TreeItemIcon } from "@mui/x-tree-view";
import FolderIcon from "@mui/icons-material/Folder";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import RemoveCircleIcon from "@mui/icons-material/RemoveCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import CommitIcon from "@mui/icons-material/Commit";
import SyncIcon from "@mui/icons-material/Sync";
import RestoreIcon from "@mui/icons-material/Restore";
import { useTreeItem, type UseTreeItemParameters } from "@mui/x-tree-view/useTreeItem";
import { TreeItemRoot, TreeItemContent, TreeItemIconContainer } from "@mui/x-tree-view/TreeItem";
import { TreeItemProvider } from "@mui/x-tree-view/TreeItemProvider";
import { useTreeItemModel } from "@mui/x-tree-view/hooks";
import {
  checkoutRepoRef,
  deployRepo,
  fetchRepo,
  resetStagingRepo,
  undeployRepo,
  unregisterRepo,
  type GitFileStatus,
  type RepoTreeInfo,
  type TreeNode,
} from "@src/services/APIClient";
import CustomGitIcon from "@src/components/CustomIcons/GitIcon";
import { notifyUser } from "@src/services/Notifications/Notification";
import { COLORS } from "@src/constants/constants";
import FileToolbar from "./FileToolbar";
import { useUIContext } from "@src/context/useUIContext";
import GitCommitDialog from "@src/components/GitCommitDialog/GitCommitDialog";
import { confirmDialog } from "@src/services/Dialog/Dialog";

type RichTreeItem = TreeViewBaseItem & {
  type: "file" | "directory";
  path: string;
  gitStatus?: GitFileStatus["status"];
  children?: RichTreeItem[];
};

export interface ProjectSectionProps {
  repo: RepoTreeInfo;
  onFileSelect: (repo_id: string, path: string) => Promise<void>;
  onRepoUpdate: (update: RepoTreeInfo) => void;
  onTreeUpdate: (update: RepoTreeInfo[]) => void;
  defaultSelectedPath?: string;
}

const getGitStatusHighlight = (status?: GitFileStatus["status"]) => {
  switch (status) {
    case "modified":
      return { color: COLORS.gitModified };
    case "added":
      return { color: COLORS.gitAdded };
    case "deleted":
      return { color: COLORS.gitDeleted };
    case "untracked":
      return { color: COLORS.gitAdded };
    default:
      return undefined;
  }
};

const hasDirtyDescendant = (children?: RichTreeItem[]): boolean =>
  !!children?.some((c) => c.gitStatus ?? hasDirtyDescendant(c.children));

const CustomTreeItem = forwardRef<HTMLLIElement, UseTreeItemParameters>(
  function CustomTreeItem(props, ref) {
    const { id, itemId, label, disabled, children, ...other } = props;
    const {
      getContextProviderProps,
      getRootProps,
      getContentProps,
      getIconContainerProps,
      getLabelProps,
      getGroupTransitionProps,
      status,
    } = useTreeItem({ id, itemId, children, label, disabled, rootRef: ref });

    const item = useTreeItemModel<RichTreeItem>(itemId)!;
    const labelSx = {
      ...getGitStatusHighlight(item.gitStatus),
      fontWeight: item.gitStatus ? 600 : 200,
    };

    const NodeIcon = item.type === "directory" ? FolderIcon : InsertDriveFileIcon;
    const NodeIconSx = { color: COLORS.midGray };
    const dirtyDir = item.type === "directory" && item.gitStatus != null;

    return (
      <TreeItemProvider {...getContextProviderProps()}>
        <TreeItemRoot {...getRootProps(other)}>
          <TreeItemContent {...getContentProps()}>
            <TreeItemIconContainer {...getIconContainerProps()}>
              <TreeItemIcon status={status} />
            </TreeItemIconContainer>
            <NodeIcon sx={NodeIconSx} />
            <TreeItemLabel {...getLabelProps()} sx={labelSx} />
            {dirtyDir && (
              <Box
                sx={{
                  flexGrow: 1,
                  mr: 1,
                  width: 6,
                  height: 6,
                  aspectRatio: 1 / 1,
                  borderRadius: "50%",
                  backgroundColor: COLORS.gitModified,
                  alignSelf: "center",
                }}
              />
            )}
          </TreeItemContent>
          {children && (
            <Collapse {...getGroupTransitionProps()} sx={{ pl: 1 }}>
              {children}
            </Collapse>
          )}
        </TreeItemRoot>
      </TreeItemProvider>
    );
  },
);

export default function ProjectSection({
  repo,
  onFileSelect,
  onRepoUpdate,
  onTreeUpdate,
  defaultSelectedPath,
}: ProjectSectionProps) {
  const REF_MAX_DISPLAY_SIZE = 7;
  const { isDeveloper, inEditMode, selectedFile, setSelectedFile } = useUIContext();
  const [sectionExpanded, setSectionExpanded] = useState(true);
  const [gitCommitOpen, setGitCommitOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(menuAnchor);
  const selectedRef = repo.checked_out_ref;
  const shortRef = (ref: string) => ref.substring(0, REF_MAX_DISPLAY_SIZE);

  function expandAll(repo: RepoTreeInfo) {
    const allDirs: string[] = [];

    function walk(node: TreeNode) {
      if (node.type === "directory") {
        allDirs.push(node.path);
        node.children?.forEach(walk);
      }
    }
    repo.tree.forEach(walk);
    setExpandedItems(allDirs);
  }

  function collapseAll() {
    setExpandedItems([]);
  }

  // highlight selected file on mount
  useEffect(() => {
    if (defaultSelectedPath) {
      setSelectedItem(defaultSelectedPath);
      const parts = defaultSelectedPath.split("/");
      const parents = parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"));
      setExpandedItems(parents);
    }
  }, [setSelectedItem, defaultSelectedPath]);

  const handleRefChange = async (ref: string) => {
    try {
      const updatedTree = await checkoutRepoRef({
        path: { repo_id: repo.id },
        query: { ref },
      }).then((r) => r.data);
      onRepoUpdate(updatedTree);
      notifyUser(`Success: HEAD at ${shortRef(ref)}`, "success");
    } catch (err) {
      notifyUser(`Failed to checkout: ${err as string}`, "error");
    }
  };

  const handleDeploy = async () => {
    if (!selectedRef) return;
    const confirmed = await confirmDialog({
      title: `Deploy ${repo.alias}@${shortRef(selectedRef)}?`,
      message: "Confirming will make this version available to operators",
      confirmText: "Deploy",
      cancelText: "Cancel",
    });
    if (!confirmed) return;
    try {
      const res = await deployRepo({
        body: { deployment_version: selectedRef },
        path: { repo_id: repo.id },
      }).then((r) => r.data);

      if (res.repo_id !== repo.id || res.ref !== selectedRef) {
        throw new Error("Invalid deployment response");
      }
      repo.deployed_ref = res.ref;
      notifyUser(`Successfully deployed ${repo.alias}@${shortRef(selectedRef)}`, "success");
    } catch (err) {
      notifyUser(`Failed to deploy repo: ${err as string}`, "error");
    }

    setMenuAnchor(null);
  };

  const handleUndeploy = async () => {
    if (!selectedRef) return;
    if (selectedRef != repo.deployed_ref) return;
    const confirmed = await confirmDialog({
      title: `Undeploy ${repo.alias}@${shortRef(selectedRef)}?`,
      message: "Confirming will make this repository unavailable to operators",
      confirmText: "Undeploy",
      cancelText: "Cancel",
    });
    if (!confirmed) return;
    try {
      const res = await undeployRepo({
        path: { repo_id: repo.id },
      });

      if (!res.response.ok) {
        const errorBody = await res.response.json().catch(() => null);
        const msg = errorBody?.detail || res.response.statusText;
        throw new Error(msg);
      }
      repo.deployed_ref = "";
      notifyUser(`Successfully undeployed ${repo.alias}`, "success");
    } catch (err) {
      notifyUser(`Failed to undeploy repo: ${err as string}`, "error");
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
    try {
      const res = await unregisterRepo({
        path: { repo_id: repo.id },
      });

      if (!res.response.ok) {
        const errorBody = await res.response.json().catch(() => null);
        const msg = errorBody?.detail || res.response.statusText;
        throw new Error(msg);
      }
      if (selectedFile?.repo_id === repo.id) {
        setSelectedFile(null);
      }
      onTreeUpdate(res.data);
      notifyUser(`Successfully unregistered ${repo.alias}`, "success");
    } catch (err) {
      notifyUser(`Failed to unregister repo: ${err as string}`, "error");
    }

    setMenuAnchor(null);
  };

  const handleSyncClick = async () => {
    try {
      const updatedTree = await fetchRepo({ path: { repo_id: repo.id } }).then((r) => r.data);
      onRepoUpdate(updatedTree);
      notifyUser(`Successfully updated ${repo.alias}`, "success");
    } catch (err) {
      notifyUser(`Failed to update ${repo.alias}: ${err as string}`, "error");
    }
  };

  const handleResetClick = async () => {
    try {
      const updatedTree = await resetStagingRepo({ path: { repo_id: repo.id } }).then(
        (r) => r.data,
      );
      onRepoUpdate(updatedTree);
      notifyUser(`Successfully restored ${repo.alias}`, "success");
    } catch (err) {
      notifyUser(`Failed to restore ${repo.alias}: ${err as string}`, "error");
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
    const map = new Map<string, GitFileStatus["status"]>();

    repo.working_tree_status?.files.forEach((f) => {
      map.set(f.path, f.status);
    });

    return map;
  }, [repo.working_tree_status]);

  // convert TreeNode[] to RichTree accepted format
  const toRichItems = useCallback(
    (nodes: TreeNode[]): RichTreeItem[] => {
      return nodes.map((node) => {
        const children = node.children ? toRichItems(node.children) : undefined;
        const fileStatus = gitStatusByPath.get(node.path);
        // mark directory as dirty if any child is dirty or if a deleted file exists under this path
        const dirDirty =
          node.type === "directory" &&
          (hasDirtyDescendant(children) ||
            repo.working_tree_status?.files.some(
              (f) => f.status === "deleted" && f.path.startsWith(node.path + "/"),
            ));

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
    [gitStatusByPath],
  );

  const items = useMemo(() => toRichItems(repo.tree), [repo.tree, toRichItems]);

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

        {repo.deployed_ref && !isDeveloper && (
          <Chip icon={<CustomGitIcon />} size="small" label={shortRef(repo.deployed_ref)} />
        )}

        {isDeveloper && (
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
              <Tooltip placement="top" title="Commit and push current changes">
                <MenuItem onClick={() => setGitCommitOpen(true)}>
                  <CommitIcon fontSize="small" sx={{ mr: 1 }} />
                  Commit
                </MenuItem>
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
          selectedPath={selectedItem ? { repo_id: repo.id, path: selectedItem } : null}
          onRepoUpdate={onRepoUpdate}
          onExpandAll={() => expandAll(repo)}
          onCollapseAll={() => collapseAll()}
        />
        <Box sx={{ px: 1, py: 0.5 }}>
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
          />
        </Box>
      </Collapse>
      <GitCommitDialog
        open={gitCommitOpen}
        onClose={() => setGitCommitOpen(false)}
        repoID={repo.id}
      />
    </Paper>
  );
}
