// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

/** Shareable editor URLs: `/?repo=<alias>&path=<file path>&mode=<edit|runtime>`. */

import { EDIT_MODE, RUNTIME_MODE, type Mode } from "@src/constants/constants";

const RETURN_TO_KEY = "loginReturnTo";

export interface FileLink {
  /** Repository alias */
  repo?: string;
  path?: string;
  mode?: Mode;
}

/** `encodeURIComponent`, keeping `/` readable (allowed unescaped in a query) */
const encode = (value: string) => encodeURIComponent(value).replaceAll("%2F", "/");

/** Query string of a file link, "" when no file is given */
export function buildFileSearch({ repo, path, mode }: FileLink): string {
  if (!repo || !path) return "";
  const modeParam = mode ? `&mode=${mode}` : "";
  return `?repo=${encode(repo)}&path=${encode(path)}${modeParam}`;
}

export function parseFileSearch(search: string): FileLink {
  const params = new URLSearchParams(search);
  const mode = params.get("mode");
  return {
    repo: params.get("repo") ?? undefined,
    path: params.get("path") ?? undefined,
    mode: mode === EDIT_MODE || mode === RUNTIME_MODE ? mode : undefined,
  };
}

/** Whether any segment of the path is hidden (`_` prefix) in runtime mode */
export function isHiddenPath(path: string): boolean {
  return path.split("/").some((segment) => segment.startsWith("_"));
}

/** Stores the location to return to after a login (which leaves the page). */
export function saveReturnTo(location: string) {
  sessionStorage.setItem(RETURN_TO_KEY, location);
}

/** Returns and forgets the location saved before the login. */
export function takeReturnTo(): string | null {
  const location = sessionStorage.getItem(RETURN_TO_KEY);
  sessionStorage.removeItem(RETURN_TO_KEY);
  return location;
}

/**
 * File link the editor opens on load: the current URL on the editor page, or the location saved
 * before the login while the login callback still runs.
 */
export function pendingFileLink(): FileLink {
  if (window.location.pathname === "/") return parseFileSearch(window.location.search);
  const saved = sessionStorage.getItem(RETURN_TO_KEY);
  if (!saved) return {};
  const url = new URL(saved, window.location.origin);
  return url.pathname === "/" ? parseFileSearch(url.search) : {};
}
