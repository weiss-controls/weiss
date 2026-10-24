// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import type { ExportedWidget, TabEntry } from "@src/types/widgets";
import { resolveRelativePath } from "@src/utils/repoPath";

/**
 * Phoebus resolves file paths against the directory of the display that uses them, while WEISS
 * stores repo-root-relative paths (see `src/utils/repoPath.ts`).
 */

/** Absolute file system paths, URLs and paths starting with a macro cannot be mapped to the repo. */
function isRelative(path: string): boolean {
  return !/^(\/|\$[({]|[a-z][a-z0-9+.-]*:)/i.test(path);
}

/**
 * Rewrites the file paths of the converted widgets (images, embedded displays, navigation buttons
 * and tabs) as repo paths, resolved against `opiPath`, the repo path of the converted display.
 */
export function resolveFilePaths(
  widgets: ExportedWidget[],
  opiPath: string,
  warnings: string[],
): void {
  const resolve = (path: string): string => {
    if (!path) return path;
    if (isRelative(path)) return resolveRelativePath(path, opiPath);
    warnings.push(`Path "${path}" is not relative to the display - update it manually.`);
    return path;
  };

  for (const widget of widgets) {
    const props = widget.properties;
    if (typeof props.imagePath === "string") props.imagePath = resolve(props.imagePath);
    if (typeof props.displayPath === "string") props.displayPath = resolve(props.displayPath);
    if (Array.isArray(props.tabs)) {
      props.tabs = (props.tabs as TabEntry[]).map((tab) => ({
        ...tab,
        displayPath: resolve(tab.displayPath),
      }));
    }
    if (widget.children) resolveFilePaths(widget.children, opiPath, warnings);
  }
}
