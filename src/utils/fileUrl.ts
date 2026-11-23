// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

/** Shareable editor URLs: `/?repo=<alias>&path=<file path>&mode=<edit|runtime>&ctx=<context>`. */

import { EDIT_MODE, RUNTIME_MODE, type Mode } from "@src/constants/constants";

const RETURN_TO_KEY = "loginReturnTo";

type Macros = Record<string, string>;

export interface FileLink {
  /** Repository alias */
  repo?: string;
  path?: string;
  mode?: Mode;
  /** Encoded navigation macros of the screen, see `encodeScreenContext` */
  ctx?: string;
}

/** `encodeURIComponent`, keeping `/` readable (allowed unescaped in a query) */
const encode = (value: string) => encodeURIComponent(value).replaceAll("%2F", "/");

/** Query string of a file link, "" when no file is given */
export function buildFileSearch({ repo, path, mode, ctx }: FileLink): string {
  if (!repo || !path) return "";
  const modeParam = mode ? `&mode=${mode}` : "";
  const ctxParam = ctx ? `&ctx=${ctx}` : "";
  return `?repo=${encode(repo)}&path=${encode(path)}${modeParam}${ctxParam}`;
}

export function parseFileSearch(search: string): FileLink {
  const params = new URLSearchParams(search);
  const mode = params.get("mode");
  return {
    repo: params.get("repo") ?? undefined,
    path: params.get("path") ?? undefined,
    mode: mode === EDIT_MODE || mode === RUNTIME_MODE ? mode : undefined,
    ctx: params.get("ctx") ?? undefined,
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

/*
 * Screen context (`ctx`) encodes the navigation macros a screen was opened with, to allow sharing
 * links to keep their macros properly loaded.
 * It is  composed of `base64url(zlib-deflate(JSON.stringify({ s, m })))`, where `m` are the macros
 * and `s` a hash of the repository alias and path. The zlib checksum rejects mistyped or truncated
 * links, and the hash rejects a context reused with another screen.
 *
 * This encoding-and-checking keeps links from being composed or edited accidentaly by hand, while allowing
 * screens to be shared.
 *
 * NOTE: This is not a security measure!!
 */

interface ScreenContext {
  /** FNV-1a hash of the repository alias and path */
  s: string;
  /** Navigation macros */
  m: Macros;
}

/** 32-bit FNV-1a hash, base 36 */
function screenHash(repo: string, path: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(`${repo}\n${path}`)) {
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

async function transform(bytes: Uint8Array<ArrayBuffer>, stream: GenericTransformStream) {
  const output = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(output).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function encodeScreenContext(repo: string, path: string, macros: Macros) {
  const context: ScreenContext = { s: screenHash(repo, path), m: macros };
  const json = new TextEncoder().encode(JSON.stringify(context));
  return toBase64Url(await transform(json, new CompressionStream("deflate")));
}

/** Macros of a screen context, or null when it is damaged or belongs to another screen. */
export async function decodeScreenContext(
  ctx: string,
  repo: string,
  path: string,
): Promise<Macros | null> {
  try {
    const json = await transform(fromBase64Url(ctx), new DecompressionStream("deflate"));
    const context = JSON.parse(new TextDecoder().decode(json)) as ScreenContext;
    const valid =
      context.s === screenHash(repo, path) &&
      typeof context.m === "object" &&
      context.m !== null &&
      Object.values(context.m).every((v) => typeof v === "string");
    return valid ? context.m : null;
  } catch {
    return null;
  }
}
