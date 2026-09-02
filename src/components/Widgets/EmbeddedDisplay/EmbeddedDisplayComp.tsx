// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import { useUIContext } from "@src/context/useUIContext";
import { useWidgetContext } from "@src/context/useWidgetContext";
import { resolveRepoPath } from "@src/utils/repoPath";
import {
  applyDisplayLayout,
  fetchDisplayContent,
  macrosToKey,
  resolveDisplayMacros,
  type DisplayContent,
} from "@components/Widgets/shared/embeddedContent";
import { Placeholder } from "@components/Widgets/shared/Placeholder";

const EmbeddedDisplayComp: React.FC<WidgetUpdate> = ({ data }) => {
  const { isDeveloper, selectedFile, inEditMode } = useUIContext();
  const { updateWidgetChildren, fileLoadedTrig, globalMacros } = useWidgetContext();
  const p = data.editableProperties;

  const repoId = selectedFile?.repo_id ?? "";
  const opiPath = selectedFile?.path ?? "";
  const displayPath = p.displayPath?.value;
  const resolvedPath = displayPath ? resolveRepoPath(displayPath, opiPath) : undefined;
  const displayMacros = p.macros?.value;

  const x = p.x?.value ?? 0;
  const y = p.y?.value ?? 0;
  const targetW = p.width?.value ?? 100;
  const targetH = p.height?.value ?? 70;

  // Stable ref so effects never need to add this directly to their dependency
  // array. `updateWidgetChildren` changes identity on every widget-state
  // update (transitively dependent on `editorWidgets` through `getWidget`),
  // so including it directly would cause infinite re-fetch/re-layout loops.
  const updateChildrenRef = useRef(updateWidgetChildren);
  updateChildrenRef.current = updateWidgetChildren;

  // Per-instance cache of the last successfully parsed & bounds-computed
  // content. Allocated fresh per component instance (per useRef semantics),
  // so two EmbeddedDisplay widgets pointing at the same displayPath each get
  // their own copy here — only the unscaled network fetch is shared via
  // _contentCache below, never the scale/layout output.
  const rawContentRef = useRef<DisplayContent | null>(null);

  const lastAppliedLayoutKeyRef = useRef<string>("");

  const resolvedDisplayMacros = useMemo(
    () => resolveDisplayMacros(displayMacros, globalMacros),
    [displayMacros, globalMacros],
  );
  const resolvedMacroKey = useMemo(
    () => macrosToKey(resolvedDisplayMacros),
    [resolvedDisplayMacros],
  );

  const macrosRef = useRef<Record<string, string>>({});
  macrosRef.current = resolvedDisplayMacros;

  /**
   * Re-derive scaled child widgets from `rawContentRef` and push them via
   * `updateWidgetChildren`. Pure re-layout — no network I/O — so it's cheap
   * to call whenever this instance's own box (x/y/width/height) changes.
   */
  const layoutAndApply = useCallback(() => {
    const cached = rawContentRef.current;
    if (!cached) return;

    const macroKey = macrosToKey(macrosRef.current);
    const layoutKey = `${targetW}|${targetH}|${x}|${y}|${macroKey}`;
    if (layoutKey === lastAppliedLayoutKeyRef.current) return;

    lastAppliedLayoutKeyRef.current = layoutKey;
    const withMacros = applyDisplayLayout(
      cached,
      { x, y, width: targetW, height: targetH },
      macrosRef.current,
    );
    updateChildrenRef.current(data.id, withMacros, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.id, x, y, targetW, targetH]);

  // Fetch effect: only re-runs on source/mode change. The network
  // request (and JSON parse) is shared across instances via _contentCache;
  // this effect just stores the parsed result + natural bounds locally and
  // triggers an initial layout.
  useEffect(() => {
    if (!repoId || !resolvedPath) {
      rawContentRef.current = null;
      lastAppliedLayoutKeyRef.current = "";
      updateChildrenRef.current(data.id, [], false);
      return;
    }

    let cancelled = false;

    const fetchDisplay = async () => {
      try {
        const content = await fetchDisplayContent(
          repoId,
          resolvedPath,
          isDeveloper,
          fileLoadedTrig,
        );
        if (cancelled) return;

        rawContentRef.current = content;
        lastAppliedLayoutKeyRef.current = "";
        layoutAndApply();
      } catch {
        if (!cancelled) {
          rawContentRef.current = null;
          lastAppliedLayoutKeyRef.current = "";
          updateChildrenRef.current(data.id, [], false);
        }
      }
    };

    void fetchDisplay();
    return () => {
      cancelled = true;
    };
    // layoutAndApply is intentionally omitted: it's re-created when x/y/width/height
    // change, which would otherwise re-trigger a full re-fetch on every resize tick.
    // The dedicated layout effect below handles those changes instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId, resolvedPath, isDeveloper, data.id, fileLoadedTrig]);

  // Macro edits are instance-local and should not trigger any re-fetch; just
  // force a fresh layout+macro pass for this instance.
  useEffect(() => {
    lastAppliedLayoutKeyRef.current = "";
    layoutAndApply();
  }, [resolvedMacroKey, layoutAndApply]);

  // Layout effect: re-runs per-instance whenever THIS widget's own box
  // changes (x/y/width/height, via layoutAndApply's deps). No network call —
  // just re-scales the already-fetched content in rawContentRef.
  useEffect(() => {
    layoutAndApply();
  }, [layoutAndApply]);

  const hasChildren = (data.children?.length ?? 0) > 0;
  if (hasChildren) return null;

  if (!inEditMode) return null;
  return <Placeholder label={resolvedPath ? "Loading…" : "No display selected"} />;
};

export { EmbeddedDisplayComp };
