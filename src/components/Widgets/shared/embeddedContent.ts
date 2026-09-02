// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { v4 as uuidv4 } from "uuid";
import { getDeployedRepoFile, getStagingRepoFile } from "@src/services/APIClient";
import { substituteMacroInStr, substituteMacrosInWidgetTree } from "@src/utils/macros";
import { parseSerializedRules } from "@src/utils/ruleCompatibility";
import { createGroupWidget } from "@src/context/widgetHelpers";
import WidgetRegistry from "@components/WidgetRegistry/WidgetRegistry";
import type { ExportedWidget, PropertyKey, Widget, WidgetProperties } from "@src/types/widgets";

/**
 * Cache of raw ExportedWidget arrays keyed by "<fileLoadedTrig>::<staging|deployed>::<repoId>::<path>".
 * Including fileLoadedTrig in the key ensures each file load fetches at least once,
 * while repeated instances of the same embedded path within the same file share
 * a single in-flight request.
 */
const _contentCache = new Map<string, Promise<ExportedWidget[]>>();

/** Parsed, bounds-computed content ready to be scaled into a target box. */
export interface DisplayContent {
  baseWidgets: Widget[];
  natW: number;
  natH: number;
  minX: number;
  minY: number;
}

/** Axis-aligned box in the editor's absolute canvas coordinate space. */
export interface TargetBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Reconstruct a Widget instance from a serialised ExportedWidget so it can be
 * inserted into the editor widget tree.  Works recursively.
 * Any widget whose type is unrecognised is silently dropped.
 */
export function exportedToWidget(raw: ExportedWidget): Widget | null {
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

  const rules = parseSerializedRules(raw.rules);

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
export function computeNatBounds(exported: ExportedWidget[]): {
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
export function scaleWidgets(
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

export function macrosToKey(macros: Record<string, string>): string {
  const entries = Object.entries(macros);
  if (entries.length === 0) return "";
  entries.sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

/**
 * Resolve local macro values against app-level global macros.
 * This keeps support for values like "$(A)" inside the local macro table.
 */
export function resolveDisplayMacros(
  displayMacros: Record<string, string> | undefined,
  globalMacros: Record<string, string>,
): Record<string, string> {
  if (!displayMacros) return {};

  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(displayMacros)) {
    resolved[key] = substituteMacroInStr(value, globalMacros);
  }
  return resolved;
}

/** Assign new UUIDs to avoid ID clashes when multiple instances of the same display exist. */
export function assignNewIds(w: Widget): Widget {
  return {
    ...w,
    id: `${w.widgetName}-${uuidv4()}`,
    children: w.children?.map(assignNewIds),
  };
}

/**
 * Fetch + parse an embedded ".opi.json" file's content and compute its natural
 * bounds. Network requests are shared across instances via `_contentCache`
 * (keyed by fileLoadedTrig/staging-or-deployed/repoId/path), so repeated
 * instances of the same embedded path fetch at most once per file load.
 * Throws on network/parse failure; callers should catch and reset state.
 */
export async function fetchDisplayContent(
  repoId: string,
  resolvedPath: string,
  isDeveloper: boolean,
  fileLoadedTrig: number,
): Promise<DisplayContent> {
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

  const baseWidgets = exported
    .map(exportedToWidget)
    .filter((widget): widget is Widget => widget !== null)
    .map(assignNewIds);

  return { baseWidgets, ...computeNatBounds(exported) };
}

/**
 * Scale previously fetched content (see `fetchDisplayContent`) into a target
 * box and substitute macro values.
 */
export function applyDisplayLayout(
  content: DisplayContent,
  box: TargetBox,
  macros: Record<string, string>,
): Widget[] {
  const { baseWidgets, natW, natH, minX, minY } = content;
  const scale = natW > 0 && natH > 0 ? Math.min(box.width / natW, box.height / natH) : 1;

  // Center the scaled content within the target box.
  const offsetX = box.x + (box.width - natW * scale) / 2;
  const offsetY = box.y + (box.height - natH * scale) / 2;

  const fresh = scaleWidgets(baseWidgets, scale, offsetX, offsetY, minX, minY);
  return substituteMacrosInWidgetTree(fresh, macros);
}
