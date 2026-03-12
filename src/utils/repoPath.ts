// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

/**
 * Utilities for translating between repo-absolute paths and OPI-relative paths.
 *
 * All paths are POSIX-style and relative to the repo root (no leading slash).
 * "OPI-relative" means relative to the directory containing the OPI (.json) file.
 * Stored values always start with `./` (same dir or deeper) or `../` (going up).
 *
 * Example:
 *   OPI at  "screens/main.json"  (opiDir = "screens")
 *   Image at "images/logo.png"   (absolute repo path)
 *   Relative path: "../images/logo.png"
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
 * Resolve an OPI-relative path to an absolute repo path.
 */
export function resolveRepoPath(imagePath: string, opiPath: string): string {
  if (!imagePath) return imagePath;
  const dir = opiDir(opiPath);
  return normalizePath(dir ? `${dir}/${imagePath}` : imagePath);
}

/**
 * Convert an absolute repo path to a path relative to the OPI file's directory.
 * The result always starts with `./` or `../`.
 */
export function toRelativeRepoPath(absPath: string, opiPath: string): string {
  const dir = opiDir(opiPath);

  if (!dir) return `./${absPath}`;

  const fromParts = dir.split("/");
  const toParts = absPath.split("/");

  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  ) {
    common++;
  }

  const ups = fromParts.length - common;
  const rest = toParts.slice(common);
  const segments = [...Array<string>(ups).fill(".."), ...rest];
  return (ups === 0 ? "./" : "") + segments.join("/");
}
