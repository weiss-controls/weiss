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
  const withGeometry = widgets.filter(
    (w) =>
      Number.isFinite(w.properties.x as number) &&
      Number.isFinite(w.properties.y as number) &&
      Number.isFinite(w.properties.width as number) &&
      Number.isFinite(w.properties.height as number),
  );
  if (!withGeometry.length) return null;

  const xs = withGeometry.map((w) => w.properties.x as number);
  const ys = withGeometry.map((w) => w.properties.y as number);
  const ws = withGeometry.map((w) => w.properties.width as number);
  const hs = withGeometry.map((w) => w.properties.height as number);

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs.map((x, i) => x + ws[i]));
  const maxY = Math.max(...ys.map((y, i) => y + hs[i]));

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

const shiftWidgetPosition = (widget: ExportedWidget, dx: number, dy: number): void => {
  if (Number.isFinite(widget.properties.x as number)) {
    (widget.properties.x as number) += dx;
  }
  if (Number.isFinite(widget.properties.y as number)) {
    (widget.properties.y as number) += dy;
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
