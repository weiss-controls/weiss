// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

/**
 * Widget types that load another display at render time and inject it as their `children`.
 * Those children are not exported, ungrouped or listed in the widget tree, and cannot be dragged.
 * Kept free of imports so stores can use it without import cycles.
 */
const EMBEDDING_WIDGETS: ReadonlySet<string> = new Set([
  "EmbeddedDisplay",
  "NavigationTabs",
  "DisplayRepeater",
]);

/** Whether a widget type injects another display's content as its `children`. */
export function isEmbeddingWidget(widgetName: string): boolean {
  return EMBEDDING_WIDGETS.has(widgetName);
}
