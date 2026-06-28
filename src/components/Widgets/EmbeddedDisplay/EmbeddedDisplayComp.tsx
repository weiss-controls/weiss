// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type { ExportedWidget, Widget, WidgetProperties, WidgetUpdate } from "@src/types/widgets";
import { useUIContext } from "@src/context/useUIContext";
import { useWidgetContext } from "@src/context/useWidgetContext";
import { getDeployedRepoFile, getStagingRepoFile } from "@src/services/APIClient";
import { resolveRepoPath } from "@src/utils/repoPath";
import { substituteMacroInStr, substituteTextProps } from "@src/utils/macros";
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

  return {
    id: `${raw.widgetName}-${uuidv4()}`,
    widgetName: raw.widgetName,
    editableProperties,
    children,
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
  return { natW: Math.max(maxX - minX, 100), natH: Math.max(maxY - minY, 70), minX, minY };
}

/**
 * Translate widget coordinates from the source OPI's coordinate space to the
 * editor's absolute canvas space.
 * Note: the EmbeddedDisplay widget is resized to fit the content of imported OPI.
 */
function offsetWidgets(
  widgets: Widget[],
  edX: number,
  edY: number,
  originX = 0,
  originY = 0,
): Widget[] {
  return widgets.map((w) => {
    const { x, y } = w.editableProperties;
    return {
      ...w,
      editableProperties: {
        ...w.editableProperties,
        ...(x && { x: { ...x, value: edX + (x.value - originX) } }),
        ...(y && { y: { ...y, value: edY + (y.value - originY) } }),
      },
      children: w.children ? offsetWidgets(w.children, edX, edY, originX, originY) : undefined,
    };
  });
}

/**
 * Walk the widget tree and replace macros in pvName, pvNames, and all text
 * selType properties (labels, tooltips, titles, etc.).
 */
function applyMacros(widgets: Widget[], macros: Record<string, string>): Widget[] {
  if (Object.keys(macros).length === 0) return widgets;
  return widgets.map((w) => {
    let props = substituteTextProps(w.editableProperties, macros);
    if (props.pvName?.value) {
      props = {
        ...props,
        pvName: { ...props.pvName, value: substituteMacroInStr(props.pvName.value, macros) },
      };
    }
    if (props.pvNames?.value && props.pvNames.value.length > 0) {
      props = {
        ...props,
        pvNames: {
          ...props.pvNames,
          value: props.pvNames.value.map((pv) => substituteMacroInStr(pv, macros)),
        },
      };
    }
    return {
      ...w,
      editableProperties: props,
      children: w.children ? applyMacros(w.children, macros) : undefined,
    };
  });
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
  const { updateWidgetChildren, updateWidgetProperties, fileLoadedTrig } = useWidgetContext();
  const p = data.editableProperties;

  const repoId = selectedFile?.repo_id ?? "";
  const opiPath = selectedFile?.path ?? "";
  const displayPath = p.displayPath?.value;
  const resolvedPath = displayPath ? resolveRepoPath(displayPath, opiPath) : undefined;
  const displayMacros = p.macros?.value;

  // Stable refs so the effect never needs to add these to its dependency array.
  // `updateWidgetProperties` changes identity on every widget-state update
  // (because it's transitively dependent on `editorWidgets` through `getWidget`),
  // so including it directly would cause infinite re-fetch loops.
  const updateChildrenRef = useRef(updateWidgetChildren);
  const updatePropertiesRef = useRef(updateWidgetProperties);
  updateChildrenRef.current = updateWidgetChildren;
  updatePropertiesRef.current = updateWidgetProperties;

  // Snapshot of the widget's position, kept in a ref so the effect doesn't need
  // x/y in its dependency array (position changes must not re-trigger the fetch).
  const layoutRef = useRef({ x: 0, y: 0 });
  layoutRef.current = {
    x: p.x?.value ?? 0,
    y: p.y?.value ?? 0,
  };

  const macrosRef = useRef<Record<string, string>>({});

  if (displayMacros !== undefined) macrosRef.current = displayMacros;

  useEffect(() => {
    if (!repoId || !resolvedPath) {
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

        const { natW, natH, minX, minY } = computeNatBounds(exported);

        const { x, y } = layoutRef.current;

        const raw = exported
          .map(exportedToWidget)
          .filter((widget): widget is Widget => widget !== null);

        const fresh = offsetWidgets(raw, x, y, minX, minY).map(assignNewIds);
        const withMacros = applyMacros(fresh, macrosRef.current);

        updateChildrenRef.current(data.id, withMacros, false);
        // Resize the EmbeddedDisplay to fit the imported content naturally.
        // Also persist natural dimensions for the aspect-ratio lock in WidgetRenderer.
        updatePropertiesRef.current(data.id, { width: natW, height: natH }, false);
      } catch {
        if (!cancelled) updateChildrenRef.current(data.id, [], false);
      }
    };

    void fetchDisplay();
    return () => {
      cancelled = true;
    };
    // layoutRef / macrosRef / updateChildrenRef / updatePropertiesRef are intentionally
    // excluded: they are always up to date via the ref pattern above.
  }, [repoId, resolvedPath, isDeveloper, data.id, displayMacros, fileLoadedTrig]);

  const hasChildren = (data.children?.length ?? 0) > 0;
  if (hasChildren) return null;

  if (!inEditMode) return null;
  return <Placeholder label={resolvedPath ? "Loading…" : "No display selected"} />;
};

export { EmbeddedDisplayComp };
