// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { useState, forwardRef, createContext, useContext } from "react";
import { Box, Tooltip, Collapse } from "@mui/material";
import {
  type TreeViewBaseItem,
  TreeItemLabel,
  TreeItemIcon,
  TreeItemLabelInput,
} from "@mui/x-tree-view";
import { useTreeItem, type UseTreeItemParameters } from "@mui/x-tree-view/useTreeItem";
import { TreeItemRoot, TreeItemContent, TreeItemIconContainer } from "@mui/x-tree-view/TreeItem";
import { TreeItemProvider } from "@mui/x-tree-view/TreeItemProvider";
import { useTreeItemModel, useTreeItemUtils } from "@mui/x-tree-view/hooks";
import FolderIcon from "@mui/icons-material/Folder";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import ImageIcon from "@mui/icons-material/Image";
import { type GitFileStatus } from "@src/services/APIClient";
import { COLORS } from "@src/constants/constants";

export type RichTreeItem = TreeViewBaseItem & {
  type: "file" | "directory";
  path: string;
  gitStatus?: GitFileStatus["status"];
  children?: RichTreeItem[];
};

export interface DragDropCtx {
  enabled: boolean;
  draggedItemId: string | null;
  dropTargetId: string | null;
  onDragStart: (itemId: string) => void;
  onDragEnd: () => void;
  onDragEnterDir: (itemId: string) => void;
  onDragLeaveDir: (itemId: string) => void;
  onDrop: (targetDirId: string) => void;
  onContextMenu?: (itemId: string, event: React.MouseEvent) => void;
}

const DragDropContext = createContext<DragDropCtx | null>(null);

export function DragDropProvider({
  value,
  children,
}: {
  value: DragDropCtx;
  children: React.ReactNode;
}) {
  return <DragDropContext.Provider value={value}>{children}</DragDropContext.Provider>;
}

const IMAGE_EXTENSIONS = new Set([".svg", ".png", ".jpg", ".jpeg"]);

const isImageFile = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot !== -1 && IMAGE_EXTENSIONS.has(name.slice(dot).toLowerCase());
};

const getGitStatusHighlight = (status?: GitFileStatus["status"]) => {
  switch (status) {
    case "modified":
    case "renamed":
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

const CustomTreeItem = forwardRef<HTMLLIElement, UseTreeItemParameters>(
  function CustomTreeItem(props, ref) {
    const { id, itemId, label, disabled, children, ...other } = props;
    const [extensionError, setExtensionError] = useState(false);
    const {
      getContextProviderProps,
      getRootProps,
      getContentProps,
      getIconContainerProps,
      getLabelProps,
      getLabelInputProps,
      getGroupTransitionProps,
      status,
    } = useTreeItem({ id, itemId, children, label, disabled, rootRef: ref });
    const { interactions } = useTreeItemUtils({ itemId, children });
    const dndCtx = useContext(DragDropContext);

    const item = useTreeItemModel<RichTreeItem>(itemId)!;
    const labelSx = {
      ...getGitStatusHighlight(item.gitStatus),
      fontWeight: item.gitStatus ? 600 : 200,
    };

    const NodeIcon =
      item.type === "directory"
        ? FolderIcon
        : isImageFile(item.label)
          ? ImageIcon
          : InsertDriveFileIcon;
    const NodeIconSx = { color: COLORS.midGray };
    const dirtyDir = item.type === "directory" && item.gitStatus != null;

    const isDragging = dndCtx?.draggedItemId === itemId;
    const isDropTarget = dndCtx?.dropTargetId === itemId && item.type === "directory";

    const dragHandlers: React.HTMLAttributes<HTMLElement> = dndCtx?.enabled
      ? {
          draggable: true,
          onDragStart: (e) => {
            e.stopPropagation();
            e.dataTransfer.effectAllowed = "move";
            dndCtx.onDragStart(itemId);
          },
          onDragEnd: () => dndCtx.onDragEnd(),
          ...(item.type === "directory"
            ? {
                onDragOver: (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = "move";
                },
                onDragEnter: (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const ct = e.currentTarget as HTMLElement;
                  const rt = e.relatedTarget as Node | null;
                  if (!rt || !ct.contains(rt)) dndCtx.onDragEnterDir(itemId);
                },
                onDragLeave: (e) => {
                  e.stopPropagation();
                  const ct = e.currentTarget as HTMLElement;
                  const rt = e.relatedTarget as Node | null;
                  if (!rt || !ct.contains(rt)) dndCtx.onDragLeaveDir(itemId);
                },
                onDrop: (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  dndCtx.onDrop(itemId);
                },
              }
            : {}),
        }
      : {};

    // Derive old extension from the item's path (itemId is the full relative path)
    // Treat compound extensions like .opi.json as a single unit.
    const oldName = itemId.slice(itemId.lastIndexOf("/") + 1);
    const getExt = (name: string): string => {
      const lower = name.toLowerCase();
      if (lower.endsWith(".opi.json")) return ".opi.json";
      const dot = name.lastIndexOf(".");
      return dot !== -1 ? name.slice(dot).toLowerCase() : "";
    };
    const oldExt = getExt(oldName);

    const handleInputChange = getLabelInputProps({
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        if (oldExt) {
          const val = e.target.value;
          const newExt = getExt(val);
          setExtensionError(newExt !== oldExt);
        }
      },
      onBlur: (event: React.FocusEvent<HTMLInputElement>) => {
        if (extensionError) {
          (event as unknown as { defaultMuiPrevented: boolean }).defaultMuiPrevented = true;
        }
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
        (event as unknown as { defaultMuiPrevented: boolean }).defaultMuiPrevented = true;
        const target = event.target as HTMLInputElement;
        if (event.key === "Enter") {
          if (!extensionError && target.value.trim()) {
            interactions.handleSaveItemLabel(event, target.value);
          }
        } else if (event.key === "Escape") {
          setExtensionError(false);
          interactions.handleCancelItemLabelEditing(event);
        }
      },
    });

    return (
      <TreeItemProvider {...getContextProviderProps()}>
        <TreeItemRoot {...getRootProps(other)}>
          <TreeItemContent
            {...getContentProps()}
            {...dragHandlers}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dndCtx?.onContextMenu?.(itemId, e);
            }}
            style={{
              ...(isDragging ? { opacity: 0.5 } : {}),
              ...(isDropTarget
                ? { outline: `2px solid ${COLORS.highlighted}`, borderRadius: "4px" }
                : {}),
            }}
          >
            <TreeItemIconContainer {...getIconContainerProps()}>
              <TreeItemIcon status={status} />
            </TreeItemIconContainer>
            <NodeIcon sx={NodeIconSx} />
            {status.editing ? (
              <Tooltip
                open={extensionError}
                title={`Cannot change file extension (expected '${oldExt}')`}
                placement="right"
              >
                <TreeItemLabelInput {...handleInputChange} />
              </Tooltip>
            ) : (
              <>
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
              </>
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

export default CustomTreeItem;
