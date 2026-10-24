// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { memo, useMemo, useState, useCallback, useRef } from "react";
import { RichTreeView } from "@mui/x-tree-view/RichTreeView";
import { useEditorStore } from "@src/stores/editorStore";
import { GRID_ID } from "@src/constants/constants";
import type { Widget } from "@src/types/widgets";
import WidgetRegistry from "@components/WidgetRegistry/WidgetRegistry";
import WidgetTreeItem, {
  DndProvider,
  type WidgetLayerItem,
  type WidgetTreeDndCtx,
} from "./WidgetTreeItem";

function widgetTreeLabel(w: Widget): string {
  const alias = w.editableProperties.alias?.value;
  if (alias) return alias;
  return WidgetRegistry[w.widgetName]?.widgetLabel ?? w.widgetName;
}

function buildLayerItems(widgets: Widget[], groupId: string | null): WidgetLayerItem[] {
  return widgets.map((w) => ({
    id: w.id,
    itemId: w.id,
    label: widgetTreeLabel(w),
    widgetName: w.widgetName,
    groupId,
    children:
      w.children &&
      w.children.length > 0 &&
      w.widgetName !== "EmbeddedDisplay" &&
      w.widgetName !== "NavigationTabs"
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
  const editorWidgets = useEditorStore((s) => s.editorWidgets);
  const selectedWidgetIDs = useEditorStore((s) => s.selectedWidgetIDs);
  const {
    setSelectedWidgetIDs,
    updateEditorWidgetList,
    updateWidgetChildren,
    updateWidgetProperties,
    getWidget,
  } = useEditorStore.getState();

  // build tree items (render front-first, reversed from editorWidgets)
  const topLevelWidgets = useMemo(
    () => editorWidgets.filter((w) => w.id !== GRID_ID),
    [editorWidgets],
  );

  // RichTreeView rebuilds every item when `items` changes identity. Keyed by content, the items
  // change only with ids, labels or nesting, not on moves or other property edits.
  const treeItemsKey = JSON.stringify(buildLayerItems([...topLevelWidgets].reverse(), null));
  const treeItems = useMemo(() => JSON.parse(treeItemsKey) as WidgetLayerItem[], [treeItemsKey]);

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

  // Latest handlers for the stable callbacks below
  const handleDropRef = useRef(handleDrop);
  handleDropRef.current = handleDrop;
  const updateWidgetPropertiesRef = useRef(updateWidgetProperties);
  updateWidgetPropertiesRef.current = updateWidgetProperties;

  const stableDrop = useCallback<WidgetTreeDndCtx["onDrop"]>(
    (...args) => handleDropRef.current(...args),
    [],
  );
  const handleItemLabelChange = useCallback((itemId: string, newLabel: string) => {
    updateWidgetPropertiesRef.current(itemId, { alias: newLabel });
  }, []);

  const dndCtx = useMemo<WidgetTreeDndCtx>(
    () => ({
      draggedItemId,
      draggedGroupId,
      dropTarget,
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
      onDragOver: handleDragOver,
      onDrop: stableDrop,
    }),
    [
      draggedItemId,
      draggedGroupId,
      dropTarget,
      handleDragStart,
      handleDragEnd,
      handleDragOver,
      stableDrop,
    ],
  );

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
        isItemEditable={(item) => item.id !== GRID_ID}
        onItemLabelChange={handleItemLabelChange}
        defaultExpandedItems={defaultExpandedIds}
        slots={{ item: WidgetTreeItem }}
        sx={{ p: 1 }}
      />
    </DndProvider>
  );
};

export default memo(WidgetTree);
