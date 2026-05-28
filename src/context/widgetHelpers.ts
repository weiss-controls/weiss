// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { ROUNDING_CONST } from "@src/constants/constants";
import { PROPERTY_SCHEMAS } from "@src/types/widgetProperties";
import type {
  MultiWidgetPropertyUpdates,
  Widget,
  WidgetDefinition,
  WidgetProperties,
  WidgetProperty,
  PropertyKey,
  DOMRectLike,
  PropertyValue,
} from "@src/types/widgets";

/**
 * Deep clone a single widget including its editable properties and children recursively.
 * @param widget Widget to clone
 * @returns Cloned widget
 */
export function deepCloneWidget(widget: Widget): Widget {
  return {
    ...widget,
    // clone editableProperties deeply
    editableProperties: Object.fromEntries(
      Object.entries(widget.editableProperties).map(([k, v]) => [
        k,
        { ...v, value: structuredClone(v.value) },
      ]),
    ),
    // recursively clone children if any
    children: widget.children?.map((child) => deepCloneWidget(child)),
  };
}

/**
 * Deep clone a list of widgets.
 * @param widgets Array of widgets to clone
 * @returns A deep-cloned array of widgets
 */
export function deepCloneWidgetList(widgets: Widget[]): Widget[] {
  return widgets.map(deepCloneWidget);
}

/**
 * Create a new Widget runtime instance from a WidgetDefinition.
 * Deep-clones default properties so each instance is fully independent.
 * @param def WidgetDefinition to instantiate
 * @param id Unique ID for the new instance
 */
export function createWidgetInstance(def: WidgetDefinition, id: string): Widget {
  return {
    id,
    widgetName: def.widgetName,
    editableProperties: Object.fromEntries(
      Object.entries(def.defaultProperties).map(([k, v]) => [
        k,
        { ...v, value: structuredClone(v.value) },
      ]),
    ),
  };
}

const POSITIONAL_KEYS = new Set<PropertyKey>(["x", "y", "width", "height"]);

export function updateWidgets(widgets: Widget[], updates: MultiWidgetPropertyUpdates): Widget[] {
  const updateOne = (w: Widget): Widget => {
    let newWidget = w;

    // Apply update if it exists for this widget ID
    const changes = updates[w.id];
    if (changes) {
      const updatedProps: WidgetProperties = { ...w.editableProperties };
      for (const [k, v] of Object.entries(changes)) {
        const propName = k as PropertyKey;
        if (!updatedProps[propName]) {
          console.warn(`Tried updating inexistent property ${propName} on ${w.id}`);
          continue;
        }
        let newValue: PropertyValue = v;
        if (typeof newValue === "number") {
          const limits = updatedProps[propName].limits;
          if (limits?.min !== undefined) newValue = Math.max(newValue, limits.min);
          if (limits?.max !== undefined) newValue = Math.min(newValue, limits.max);
          if (POSITIONAL_KEYS.has(propName))
            newValue = Math.round(newValue * ROUNDING_CONST) / ROUNDING_CONST;
        }
        (updatedProps as Record<PropertyKey, WidgetProperty>)[propName] = {
          ...updatedProps[propName],
          value: newValue,
        };
      }
      newWidget = { ...newWidget, editableProperties: updatedProps };
    }

    if (w.children?.length) {
      const updatedChildren = w.children.map(updateOne);
      // Only recreate if children changed
      if (updatedChildren.some((c, i) => c !== w.children![i])) {
        newWidget = { ...newWidget, children: updatedChildren };
      }
    }

    return newWidget;
  };

  return widgets.map(updateOne);
}

export function getWidgetNested(widgets: Widget[], id: string): Widget | undefined {
  for (const w of widgets) {
    if (w.id === id) return w;
    if (w.children) {
      const found = getWidgetNested(w.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function getSelectedWidgets(widgets: Widget[], selectedIds: string[]): Widget[] {
  const result: Widget[] = [];
  for (const w of widgets) {
    if (selectedIds.includes(w.id)) result.push(w);
    if (w.children?.length) result.push(...getSelectedWidgets(w.children, selectedIds));
  }
  return result;
}

/**
 * Create a new group widget instance with optional children and bounds.
 */
export function createGroupWidget(
  id: string,
  children: Widget[] = [],
  bounds?: DOMRectLike,
): Widget {
  return {
    id,
    widgetName: "Group",
    children,
    editableProperties: {
      x: { ...PROPERTY_SCHEMAS.x, value: bounds?.x ?? 0 },
      y: { ...PROPERTY_SCHEMAS.y, value: bounds?.y ?? 0 },
      width: { ...PROPERTY_SCHEMAS.width, value: bounds?.width ?? 0 },
      height: { ...PROPERTY_SCHEMAS.height, value: bounds?.height ?? 0 },
    },
  };
}

/**
 * Recursively get changes in position for when widget has children.
 */
export function getNestedMoveUpdates(
  widget: Widget,
  dx: number,
  dy: number,
  scaleX: number,
  scaleY: number,
  updates: MultiWidgetPropertyUpdates,
  parentOldX?: number,
  parentOldY?: number,
  parentNewX?: number,
  parentNewY?: number,
) {
  const oldX = widget.editableProperties.x?.value ?? 0;
  const oldY = widget.editableProperties.y?.value ?? 0;
  const oldW = widget.editableProperties.width?.value ?? 0;
  const oldH = widget.editableProperties.height?.value ?? 0;

  let newX: number;
  let newY: number;

  if (parentOldX === undefined || parentOldY === undefined) {
    newX = oldX + dx;
    newY = oldY + dy;
  } else {
    const relX = oldX - parentOldX;
    const relY = oldY - parentOldY;
    newX = (parentNewX ?? parentOldX) + relX * scaleX;
    newY = (parentNewY ?? parentOldY) + relY * scaleY;
  }

  const newW = oldW * scaleX;
  const newH = oldH * scaleY;

  updates[widget.id] = {
    x: newX,
    y: newY,
    width: newW,
    height: newH,
  };

  if (widget.children?.length) {
    for (const child of widget.children) {
      getNestedMoveUpdates(child, dx, dy, scaleX, scaleY, updates, oldX, oldY, newX, newY);
    }
  }
}

/**
 * Flatten an entire widget tree (including all nested children) into a single
 * array. Preserves document order (parent before children).
 */
export function flattenWidgetTree(widgets: Widget[]): Widget[] {
  const result: Widget[] = [];
  for (const w of widgets) {
    result.push(w);
    if (w.children?.length) {
      result.push(...flattenWidgetTree(w.children));
    }
  }
  return result;
}
