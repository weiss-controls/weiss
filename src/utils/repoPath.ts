// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

/**
 * All repo file paths (imagePath, displayPath, etc.) are stored as absolute,
 * repo-root-relative POSIX paths (no leading slash, no `./` or `../`), matching
 * what the API accepts. This avoids ambiguity when a display is embedded inside
 * another OPI file at a different depth: a path relative to the *authoring* OPI's
 * directory would otherwise be resolved against the *embedding* OPI's directory
 * instead, since only one currently-open file path is tracked at render time.
 *
 * `resolveRepoPath` still accepts legacy `./`/`../`-prefixed values (from OPI
 * files saved before this change, or manually typed by a user) and resolves them
 * against `opiPath` for backward compatibility; anything else is treated as
 * already absolute and only normalized.
 */

/** Returns the directory portion of a repo-relative file path (no trailing slash). */
function opiDir(opiPath: string): string {
  const slash = opiPath.lastIndexOf("/");
  return slash === -1 ? "" : opiPath.slice(0, slash);
}

/** Collapse `.` and `..` segments in a POSIX path (no leading slash). */
function normalizePath(path: string): string {
  const parts = path.split("/");
  const result: string[] = [];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") {
      if (result.length > 0) result.pop();
    } else {
      result.push(part);
    }
  }
  return result.join("/");
}

/**
 * Resolve a repo file path to an absolute repo path. Values already absolute
 * are only normalized; values starting with `./` or `../` (legacy format) are
 * resolved against the directory of `opiPath`.
 */
export function resolveRepoPath(imagePath: string, opiPath: string): string {
  if (!imagePath) return imagePath;
  if (!imagePath.startsWith("./") && !imagePath.startsWith("../")) {
    return normalizePath(imagePath);
  }
  const dir = opiDir(opiPath);
  return normalizePath(dir ? `${dir}/${imagePath}` : imagePath);
}
