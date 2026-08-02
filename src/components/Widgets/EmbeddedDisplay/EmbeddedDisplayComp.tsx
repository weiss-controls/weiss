// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useCallback, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type { ExportedWidget, Widget, WidgetProperties, WidgetUpdate } from "@src/types/widgets";
import { useUIContext } from "@src/context/useUIContext";
import { useWidgetContext } from "@src/context/useWidgetContext";
import { getDeployedRepoFile, getStagingRepoFile } from "@src/services/APIClient";
import { resolveRepoPath } from "@src/utils/repoPath";
import { substituteMacrosInWidgetTree } from "@src/utils/macros";
import WidgetRegistry from "@components/WidgetRegistry/WidgetRegistry";
import { createGroupWidget } from "@src/context/widgetHelpers";
import type { PropertyKey } from "@src/types/widgets";

/**
 * Cache of raw ExportedWidget arrays keyed by "<fileLoadedTrig>::<staging|deployed>::<repoId>::<path>".
 * Including fileLoadedTrig in the key ensures each file load fetches at least once,
 * while repeated instances of the same embedded path within the same file share
 * a single in-flight request.
 */
const _contentCache = new Map<string, Promise<ExportedWidget[]>>();

/**
 * Reconstruct a Widget instance from a serialised ExportedWidget so it can be
 * inserted into the editor widget tree.  Works recursively.
 * Any widget whose type is unrecognised is silently dropped.
 */
function exportedToWidget(raw: ExportedWidget): Widget | null {
  if (raw.widgetName === "GridZone") return null;

  const children = raw.children?.map(exportedToWidget).filter((w): w is Widget => w !== null);

  // groups are not in the registry
  if (raw.widgetName === "Group") {
    const group = createGroupWidget(uuidv4(), children ?? []);
    // Overlay the serialised x/y/width/height onto the group.
    for (const key of ["x", "y", "width", "height"] as const) {
      if (raw.properties?.[key] !== undefined && group.editableProperties[key]) {
        group.editableProperties[key].value = raw.properties[key] as number;
      }
    }
    return group;
  }

  const def = WidgetRegistry[raw.widgetName];
  if (!def) return null;

  const editableProperties: WidgetProperties = Object.fromEntries(
    Object.entries(def.defaultProperties).map(([k, v]) => [
      k,
      { ...v, value: raw.properties?.[k as PropertyKey] ?? v.value },
    ]),
  );

  const rules = raw.rules?.map((r) => ({
    ...r,
    id: uuidv4(),
    pvNames: r.conditions.map((c) => c.pvName),
  }));

  return {
    id: `${raw.widgetName}-${uuidv4()}`,
    widgetName: raw.widgetName,
    editableProperties,
    children,
    rules,
  };
}

/**
 * Compute the bounding box of all widgets from the embedded OPI
 */
function computeNatBounds(exported: ExportedWidget[]): {
  natW: number;
  natH: number;
  minX: number;
  minY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const w of exported) {
    if (w.widgetName === "GridZone") continue;
    const x = (w.properties?.x as number | undefined) ?? 0;
    const y = (w.properties?.y as number | undefined) ?? 0;
    const width = (w.properties?.width as number | undefined) ?? 0;
    const height = (w.properties?.height as number | undefined) ?? 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  }

  if (!isFinite(minX)) return { natW: 100, natH: 70, minX: 0, minY: 0 };
  return { natW: maxX - minX, natH: maxY - minY, minX, minY };
}

/**
 * Translate + uniformly scale widget coordinates from the source OPI's
 * coordinate space into the editor's absolute canvas space, fitting the
 * content inside a target box (contain-style: preserves aspect ratio,
 * never overflows the box).
 */
function scaleWidgets(
  widgets: Widget[],
  scale: number,
  edX: number,
  edY: number,
  originX = 0,
  originY = 0,
): Widget[] {
  return widgets.map((w) => {
    const { x, y, width, height, borderRadius, borderWidth, fontSize } = w.editableProperties;
    return {
      ...w,
      editableProperties: {
        ...w.editableProperties,
        ...(x && { x: { ...x, value: edX + (x.value - originX) * scale } }),
        ...(y && { y: { ...y, value: edY + (y.value - originY) * scale } }),
        ...(width && { width: { ...width, value: width.value * scale } }),
        ...(height && { height: { ...height, value: height.value * scale } }),
        ...(borderRadius && {
          borderRadius: { ...borderRadius, value: borderRadius.value * scale },
        }),
        ...(borderWidth && { borderWidth: { ...borderWidth, value: borderWidth.value * scale } }),
        ...(fontSize && { fontSize: { ...fontSize, value: fontSize.value * scale } }),
      },
      children: w.children
        ? scaleWidgets(w.children, scale, edX, edY, originX, originY)
        : undefined,
    };
  });
}

function macrosToKey(macros: Record<string, string>): string {
  const entries = Object.entries(macros);
  if (entries.length === 0) return "";
  entries.sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

/** Assign new UUIDs to avoid ID clashes when multiple instances of the same display exist. */
function assignNewIds(w: Widget): Widget {
  return {
    ...w,
    id: `${w.widgetName}-${uuidv4()}`,
    children: w.children?.map(assignNewIds),
  };
}

// placeholder for file not found or invalid
const Placeholder: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      color: "#888",
      fontSize: 12,
      border: "1px dashed #888",
      boxSizing: "border-box",
    }}
  >
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
    <span>{label}</span>
  </div>
);

const EmbeddedDisplayComp: React.FC<WidgetUpdate> = ({ data }) => {
  const { isDeveloper, selectedFile, inEditMode } = useUIContext();
  const { updateWidgetChildren, fileLoadedTrig } = useWidgetContext();
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
  const rawContentRef = useRef<{
    baseWidgets: Widget[];
    natW: number;
    natH: number;
    minX: number;
    minY: number;
  } | null>(null);

  const lastAppliedLayoutKeyRef = useRef<string>("");

  const macrosRef = useRef<Record<string, string>>({});
  macrosRef.current = displayMacros ?? {};

  /**
   * Re-derive scaled child widgets from `rawContentRef` and push them via
   * `updateWidgetChildren`. Pure re-layout — no network I/O — so it's cheap
   * to call whenever this instance's own box (x/y/width/height) changes.
   */
  const layoutAndApply = useCallback(() => {
    const cached = rawContentRef.current;
    if (!cached) return;
    const { baseWidgets, natW, natH, minX, minY } = cached;

    const macroKey = macrosToKey(macrosRef.current);
    const layoutKey = `${targetW}|${targetH}|${x}|${y}|${macroKey}`;
    if (layoutKey === lastAppliedLayoutKeyRef.current) return;

    const scale = natW > 0 && natH > 0 ? Math.min(targetW / natW, targetH / natH) : 1;

    // Center the scaled content within the widget's box.
    const offsetX = x + (targetW - natW * scale) / 2;
    const offsetY = y + (targetH - natH * scale) / 2;

    const fresh = scaleWidgets(baseWidgets, scale, offsetX, offsetY, minX, minY);
    const withMacros = substituteMacrosInWidgetTree(fresh, macrosRef.current);
    lastAppliedLayoutKeyRef.current = layoutKey;
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
        const cacheKey = `${fileLoadedTrig}::${isDeveloper ? "staging" : "deployed"}::${repoId}::${resolvedPath}`;

        let pending = _contentCache.get(cacheKey);
        if (!pending) {
          pending = (
            isDeveloper
              ? getStagingRepoFile({ path: { repo_id: repoId }, query: { path: resolvedPath } })
              : getDeployedRepoFile({ path: { repo_id: repoId }, query: { path: resolvedPath } })
          ).then((r) => JSON.parse(r.data.content) as ExportedWidget[]);
          _contentCache.set(cacheKey, pending);
        }

        const exported = await pending;
        if (cancelled) return;

        const baseWidgets = exported
          .map(exportedToWidget)
          .filter((widget): widget is Widget => widget !== null)
          .map(assignNewIds);

        rawContentRef.current = { baseWidgets, ...computeNatBounds(exported) };
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
  }, [displayMacros, layoutAndApply]);

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
