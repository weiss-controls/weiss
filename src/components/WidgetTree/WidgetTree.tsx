// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { useMemo, useState, useCallback } from "react";
import { RichTreeView } from "@mui/x-tree-view/RichTreeView";
import { useWidgetContext } from "@src/context/useWidgetContext";
import { GRID_ID } from "@src/constants/constants";
import type { Widget } from "@src/types/widgets";
import WidgetRegistry from "@components/WidgetRegistry/WidgetRegistry";
import WidgetTreeItem, {
  DndProvider,
  type WidgetLayerItem,
  type WidgetTreeDndCtx,
} from "./WidgetTreeItem";

function buildLayerItems(widgets: Widget[], groupId: string | null): WidgetLayerItem[] {
  return widgets.map((w) => ({
    id: w.id,
    itemId: w.id,
    label: WidgetRegistry[w.widgetName]?.widgetLabel ?? w.widgetName,
    widgetName: w.widgetName,
    groupId,
    children:
      w.children && w.children.length > 0 && w.widgetName !== "EmbeddedDisplay"
        ? buildLayerItems(w.children, w.id)
        : undefined,
  }));
}

function reorderList<T extends { id: string }>(
  list: T[],
  draggedId: string,
  targetId: string,
  position: "before" | "after",
): T[] {
  const result = list.filter((item) => item.id !== draggedId);
  const dragged = list.find((item) => item.id === draggedId);
  if (!dragged) return list;
  const targetIdx = result.findIndex((item) => item.id === targetId);
  if (targetIdx === -1) return list;
  const insertAt = position === "before" ? targetIdx : targetIdx + 1;
  result.splice(insertAt, 0, dragged);
  return result;
}

const WidgetTree: React.FC = () => {
  const {
    editorWidgets,
    selectedWidgetIDs,
    setSelectedWidgetIDs,
    updateEditorWidgetList,
    updateWidgetChildren,
    getWidget,
  } = useWidgetContext();

  // build tree items (render front-first, reversed from editorWidgets)
  const topLevelWidgets = useMemo(
    () => editorWidgets.filter((w) => w.id !== GRID_ID),
    [editorWidgets],
  );

  const treeItems = useMemo<WidgetLayerItem[]>(
    () => buildLayerItems([...topLevelWidgets].reverse(), null),
    [topLevelWidgets],
  );

  const defaultExpandedIds = useMemo(
    () => topLevelWidgets.filter((w) => w.children?.length).map((w) => w.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // only compute once on mount — RichTreeView manages expand state internally
  );

  // drag-and-drop state
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: "before" | "after";
  } | null>(null);

  const handleDragStart = useCallback((id: string, groupId: string | null) => {
    setDraggedItemId(id);
    setDraggedGroupId(groupId);
    setDropTarget(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedItemId(null);
    setDraggedGroupId(null);
    setDropTarget(null);
  }, []);

  const handleDragOver = useCallback(
    (id: string, position: "before" | "after", targetGroupId: string | null) => {
      if (!draggedItemId || id === draggedItemId) return;
      // Reject cross-scope drops
      if (draggedGroupId !== targetGroupId) return;
      setDropTarget({ id, position });
    },
    [draggedItemId, draggedGroupId],
  );

  const handleDrop = useCallback(
    (targetId: string, position: "before" | "after", targetGroupId: string | null) => {
      if (!draggedItemId || draggedItemId === targetId) {
        handleDragEnd();
        return;
      }
      // Reject cross-scope drops
      if (draggedGroupId !== targetGroupId) {
        handleDragEnd();
        return;
      }

      if (draggedGroupId === null) {
        // Reorder in display order, then reverse back to storage order and
        // prepend the grid widget.
        const displayOrder = reorderList(
          [...topLevelWidgets].reverse(),
          draggedItemId,
          targetId,
          position,
        );
        const grid = editorWidgets.find((w) => w.id === GRID_ID)!;
        updateEditorWidgetList([grid, ...displayOrder.reverse()]);
      } else {
        // group children reorder
        const parent = getWidget(draggedGroupId);
        if (!parent?.children) {
          handleDragEnd();
          return;
        }
        const reordered = reorderList(parent.children, draggedItemId, targetId, position);
        updateWidgetChildren(draggedGroupId, reordered);
      }

      handleDragEnd();
    },
    [
      draggedItemId,
      draggedGroupId,
      topLevelWidgets,
      editorWidgets,
      updateEditorWidgetList,
      updateWidgetChildren,
      getWidget,
      handleDragEnd,
    ],
  );

  const dndCtx: WidgetTreeDndCtx = {
    draggedItemId,
    draggedGroupId,
    dropTarget,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  };

  const handleSelectionChange = useCallback(
    (_e: React.SyntheticEvent | null, ids: string[]) => {
      setSelectedWidgetIDs(ids);
    },
    [setSelectedWidgetIDs],
  );

  return (
    <DndProvider value={dndCtx}>
      <RichTreeView
        items={treeItems}
        selectedItems={selectedWidgetIDs}
        onSelectedItemsChange={handleSelectionChange}
        multiSelect
        isItemEditable={() => false}
        defaultExpandedItems={defaultExpandedIds}
        slots={{ item: WidgetTreeItem }}
        sx={{ p: 1 }}
      />
    </DndProvider>
  );
};

export default WidgetTree;
