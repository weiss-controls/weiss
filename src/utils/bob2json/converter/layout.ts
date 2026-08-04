// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { DOMRectLike, ExportedWidget } from "@src/types/widgets";

/**
 * Geometry helpers for post-conversion widget positioning.
 *
 * Kept separate from converter.ts to isolate bounds/centering behavior
 * from property mapping and widget-type conversion logic.
 */

const computeScreenBounds = (widgets: ExportedWidget[]): DOMRectLike | null => {
  if (!widgets.length) return null;

  const xs = widgets.map((w) => w.properties.x as number);
  const ys = widgets.map((w) => w.properties.y as number);
  const ws = widgets.map((w) => w.properties.width as number);
  const hs = widgets.map((w) => w.properties.height as number);

  if (!xs.length || !ys.length || !ws.length || !hs.length) return null;

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs.map((x, i) => x + ws[i]));
  const maxY = Math.max(...ys.map((y, i) => y + hs[i]));

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

const shiftWidgetPosition = (widget: ExportedWidget, dx: number, dy: number): void => {
  if (typeof widget.properties.x === "number") {
    widget.properties.x += dx;
  }
  if (typeof widget.properties.y === "number") {
    widget.properties.y += dy;
  }

  const children = widget.children;
  if (Array.isArray(children)) {
    for (const child of children) shiftWidgetPosition(child, dx, dy);
  }
};

export const centerWidgetsToOrigin = (
  allWidgets: ExportedWidget[],
  contentWidgets: ExportedWidget[],
): void => {
  const bounds = computeScreenBounds(contentWidgets);
  if (!bounds) return;

  const dx = -(bounds.x + bounds.width / 2);
  const dy = -(bounds.y + bounds.height / 2);

  for (const widget of allWidgets) shiftWidgetPosition(widget, dx, dy);
};
