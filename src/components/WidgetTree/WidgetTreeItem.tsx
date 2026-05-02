// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { createContext, useContext, forwardRef } from "react";
import { Collapse } from "@mui/material";
import {
  type TreeViewDefaultItemModelProperties,
  TreeItemLabel,
  TreeItemIcon,
  TreeItemLabelInput,
} from "@mui/x-tree-view";
import { useTreeItem, type UseTreeItemParameters } from "@mui/x-tree-view/useTreeItem";
import { TreeItemRoot, TreeItemContent, TreeItemIconContainer } from "@mui/x-tree-view/TreeItem";
import { TreeItemProvider } from "@mui/x-tree-view/TreeItemProvider";
import { useTreeItemModel, useTreeItemUtils } from "@mui/x-tree-view/hooks";
import WidgetsIcon from "@mui/icons-material/Widgets";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import WidgetRegistry from "@components/WidgetRegistry/WidgetRegistry";
import { COLORS } from "@src/constants/constants";

export type WidgetLayerItem = TreeViewDefaultItemModelProperties & {
  widgetName: string;
  /** null = top-level widget, string = parent group/embedded-display id */
  groupId: string | null;
  children?: WidgetLayerItem[];
};

export interface WidgetTreeDndCtx {
  draggedItemId: string | null;
  draggedGroupId: string | null;
  dropTarget: { id: string; position: "before" | "after" } | null;
  onDragStart: (id: string, groupId: string | null) => void;
  onDragEnd: () => void;
  onDragOver: (id: string, position: "before" | "after", groupId: string | null) => void;
  onDrop: (targetId: string, position: "before" | "after", targetGroupId: string | null) => void;
}

const DndContext = createContext<WidgetTreeDndCtx | null>(null);

export function DndProvider({
  value,
  children,
}: {
  value: WidgetTreeDndCtx;
  children: React.ReactNode;
}) {
  return <DndContext.Provider value={value}>{children}</DndContext.Provider>;
}

const WidgetTreeItem = forwardRef<HTMLLIElement, UseTreeItemParameters>(
  function WidgetTreeItem(props, ref) {
    const { id, itemId, label, disabled, children, ...other } = props;

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
    const dndCtx = useContext(DndContext);
    const item = useTreeItemModel<WidgetLayerItem>(itemId)!;

    const def = WidgetRegistry[item.widgetName];
    const WIcon = def?.widgetIcon;
    const iconSx = { color: COLORS.midGray, fontSize: 16 };

    const isDragging = dndCtx?.draggedItemId === itemId;
    const dropPos = dndCtx?.dropTarget?.id === itemId ? dndCtx.dropTarget.position : null;

    const dragHandlers: React.HTMLAttributes<HTMLElement> = {
      draggable: true,
      onDragStart: (e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        dndCtx?.onDragStart(itemId, item.groupId);
      },
      onDragEnd: () => dndCtx?.onDragEnd(),
      onDragOver: (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const position = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
        dndCtx?.onDragOver(itemId, position, item.groupId);
      },
      onDragLeave: (e) => {
        e.stopPropagation();
        // Only clear if leaving to outside this element
        const ct = e.currentTarget as HTMLElement;
        const rt = e.relatedTarget as Node | null;
        if (!rt || !ct.contains(rt)) {
          dndCtx?.onDragOver(itemId, "after", item.groupId); // reset by re-evaluating on next enter
        }
      },
      onDrop: (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!dndCtx) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const position = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
        dndCtx.onDrop(itemId, position, item.groupId);
      },
    };

    const handleInputChange = getLabelInputProps({
      onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
        (event as unknown as { defaultMuiPrevented: boolean }).defaultMuiPrevented = true;
        const target = event.target as HTMLInputElement;
        if (event.key === "Enter") {
          if (target.value.trim()) {
            interactions.handleSaveItemLabel(event, target.value);
          }
        } else if (event.key === "Escape") {
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
            style={{
              opacity: isDragging ? 0.4 : 1,
              borderTop: dropPos === "before" ? `2px solid ${COLORS.highlighted}` : undefined,
              borderBottom: dropPos === "after" ? `2px solid ${COLORS.highlighted}` : undefined,
            }}
          >
            <DragIndicatorIcon sx={{ opacity: "0.4" }} />
            <TreeItemIconContainer {...getIconContainerProps()}>
              <TreeItemIcon status={status} />
            </TreeItemIconContainer>
            {WIcon ? <WIcon sx={iconSx} /> : <WidgetsIcon sx={iconSx} />}
            {status.editing ? (
              <TreeItemLabelInput {...handleInputChange} />
            ) : (
              <TreeItemLabel {...getLabelProps()} sx={{ fontWeight: 300, fontSize: "0.85rem" }} />
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

export default WidgetTreeItem;
