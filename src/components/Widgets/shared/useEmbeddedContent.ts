// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { useEffect, useRef } from "react";
import type { Widget } from "@src/types/widgets";
import { useSessionStore } from "@src/stores/sessionStore";
import { useRepoStore } from "@src/stores/repoStore";
import { useEditorStore } from "@src/stores/editorStore";
import { resolveRepoPath } from "@src/utils/repoPath";
import { fetchDisplayContent, keepEmbeddedChildren, type DisplayContent } from "./embeddedContent";

/**
 * Loads another display and injects it as the `children` of an embedding widget.
 *
 * The file is fetched only when its path or the loaded file changes (the request itself is shared
 * across instances, see `fetchDisplayContent`). `build` turns the fetched content into the
 * children, already laid out and macro-substituted; it is re-run, without any network call,
 * whenever `layoutKey` changes, so the key must cover everything `build` reads (box, macros, ...).
 *
 * @param widgetId id of the embedding widget
 * @param displayPath linked display, as stored (resolved against the open file)
 * @param layoutKey identifies the current layout and macros of the widget
 * @param build maps the fetched content to the widget children
 * @returns the resolved repo path of the display, if any
 */
export function useEmbeddedContent(
  widgetId: string,
  displayPath: string | undefined,
  layoutKey: string,
  build: (content: DisplayContent) => Widget[],
): string | undefined {
  const isDeveloper = useSessionStore((s) => s.isDeveloper);
  const selectedFile = useRepoStore((s) => s.selectedFile);
  const fileLoadedTrig = useEditorStore((s) => s.fileLoadedTrig);

  const repoId = selectedFile?.repo_id ?? "";
  const opiPath = selectedFile?.path ?? "";
  const resolvedPath = displayPath ? resolveRepoPath(displayPath, opiPath) : undefined;

  const contentRef = useRef<DisplayContent | null>(null);
  const appliedKeyRef = useRef<string | null>(null);
  // Lays out the fetched content with the latest `build`/`layoutKey`. Kept in a ref so the effects
  // below can call it without re-running on every render.
  const apply = () => {
    const content = contentRef.current;
    if (!content || appliedKeyRef.current === layoutKey) return;
    appliedKeyRef.current = layoutKey;
    const { widgetIdMap, updateWidgetChildren } = useEditorStore.getState();
    updateWidgetChildren(widgetId, keepEmbeddedChildren(build(content), widgetIdMap), false);
  };
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    const clear = () => {
      contentRef.current = null;
      appliedKeyRef.current = null;
      useEditorStore.getState().updateWidgetChildren(widgetId, [], false);
    };
    if (!repoId || !resolvedPath) {
      clear();
      return;
    }

    // The previous children stay shown until the new content arrives, but are no longer re-laid out.
    contentRef.current = null;
    let cancelled = false;
    fetchDisplayContent(repoId, resolvedPath, isDeveloper, fileLoadedTrig)
      .then((content) => {
        if (cancelled) return;
        contentRef.current = content;
        appliedKeyRef.current = null;
        applyRef.current();
      })
      .catch(() => {
        if (!cancelled) clear();
      });
    return () => {
      cancelled = true;
    };
  }, [repoId, resolvedPath, isDeveloper, fileLoadedTrig, widgetId]);

  // Re-layout (no network) whenever the box or macros change.
  useEffect(() => {
    applyRef.current();
  }, [layoutKey]);

  return resolvedPath;
}
