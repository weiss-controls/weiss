// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { v4 as uuidv4 } from "uuid";
import { getDeployedRepoFile, getStagingRepoFile } from "@src/services/APIClient";
import { resolveMacroRecord, substituteMacrosInWidgetTree } from "@src/utils/macros";
import { parseSerializedRules } from "@src/utils/ruleCompatibility";
import { createGroupWidget, createWidgetInstance } from "@src/stores/widgetHelpers";
import WidgetRegistry from "@components/WidgetRegistry/WidgetRegistry";
import { isEmbeddingWidget } from "./embeddingWidgets";
import type { DOMRectLike, ExportedWidget, PropertyKey, Widget } from "@src/types/widgets";

/**
 * Cache of raw ExportedWidget arrays keyed by "<fileLoadedTrig>::<staging|deployed>::<repoId>::<path>".
 * Including fileLoadedTrig in the key ensures each file load fetches at least once,
 * while repeated instances of the same embedded path within the same file share
 * a single in-flight request.
 */
const _contentCache = new Map<string, Promise<ExportedWidget[]>>();

/** Widgets whose `macros` table takes the macros of the display they are embedded in. */
const INHERITS_MACRO_TABLE = new Set(["EmbeddedDisplay", "DisplayRepeater", "NavigationButton"]);

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
    const bounds: DOMRectLike = {
      x: (raw.properties?.x as number | undefined) ?? 0,
      y: (raw.properties?.y as number | undefined) ?? 0,
      width: (raw.properties?.width as number | undefined) ?? 0,
      height: (raw.properties?.height as number | undefined) ?? 0,
    };
    return createGroupWidget(uuidv4(), children ?? [], bounds);
  }

  const def = WidgetRegistry[raw.widgetName];
  if (!def) return null;

  const instance = createWidgetInstance(def, `${raw.widgetName}-${uuidv4()}`);
  for (const [key, val] of Object.entries(raw.properties ?? {})) {
    const propName = key as PropertyKey;
    if (instance.editableProperties[propName]) {
      instance.editableProperties[propName].value = val;
    }
  }

  return { ...instance, children, rules: parseSerializedRules(raw.rules) };
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

/** Macros of an embedded display: `all` to substitute in its widgets, `local` to pass on. */
export interface MacroScope {
  /** Global macros overridden by the local ones */
  all: Record<string, string>;
  /** The display's own macro table (with what it inherited from outer embeds), resolved */
  local: Record<string, string>;
}

/**
 * Macro scope of an embedded display: the global macros, overridden by the local macro table
 * resolved against them. The globals are included so `$(NAME=default)` falls back to the default
 * only when NAME is defined in neither.
 */
export function resolveDisplayMacros(
  displayMacros: Record<string, string> | undefined,
  globalMacros: Record<string, string>,
): MacroScope {
  if (!displayMacros) return { all: globalMacros, local: {} };
  const local = resolveMacroRecord(displayMacros, globalMacros);
  return { all: { ...globalMacros, ...local }, local };
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
  macros: MacroScope,
): Widget[] {
  const { baseWidgets, natW, natH, minX, minY } = content;
  const scale = natW > 0 && natH > 0 ? Math.min(box.width / natW, box.height / natH) : 1;

  // Center the scaled content within the target box.
  const offsetX = box.x + (box.width - natW * scale) / 2;
  const offsetY = box.y + (box.height - natH * scale) / 2;

  const fresh = scaleWidgets(baseWidgets, scale, offsetX, offsetY, minX, minY);
  return inheritDisplayMacros(substituteMacrosInWidgetTree(fresh, macros.all), macros);
}

/**
 * Split a box into the cells of a repeater grid, in instance order. Instances fill rows when
 * `horizontal` (columns otherwise); `wrapCount` instances per row/column, 0 for a single line.
 */
export function computeInstanceCells(
  box: TargetBox,
  count: number,
  horizontal: boolean,
  gap: number,
  wrapCount: number,
): TargetBox[] {
  if (count <= 0) return [];
  const perLine = wrapCount > 0 ? Math.min(wrapCount, count) : count;
  const lines = Math.ceil(count / perLine);
  const cols = horizontal ? perLine : lines;
  const rows = horizontal ? lines : perLine;
  const cellW = Math.max((box.width - gap * (cols - 1)) / cols, 0);
  const cellH = Math.max((box.height - gap * (rows - 1)) / rows, 0);

  return Array.from({ length: count }, (_, i) => {
    const line = Math.floor(i / perLine);
    const pos = i % perLine;
    const col = horizontal ? pos : line;
    const row = horizontal ? line : pos;
    return {
      x: box.x + col * (cellW + gap),
      y: box.y + row * (cellH + gap),
      width: cellW,
      height: cellH,
    };
  });
}

/**
 * Carry over the content already loaded by nested embedding widgets (looked up by id in
 * the current tree), which their own components re-apply when their box or macros change.
 */
export function keepEmbeddedChildren(widgets: Widget[], current: Map<string, Widget>): Widget[] {
  return widgets.map((w) => {
    if (isEmbeddingWidget(w.widgetName)) {
      const children = current.get(w.id)?.children;
      return children ? { ...w, children } : w;
    }
    return w.children ? { ...w, children: keepEmbeddedChildren(w.children, current) } : w;
  });
}

/**
 * Pass the local macros of an embedded display on to the widgets that use their own macro table:
 * nested embedding widgets, which resolve their content with it, and navigation buttons, which
 * forward it to the display they open. The widget's own entries win. Only the local scope is
 * passed: the globals are already in scope of nested embeds, and forwarding them would override
 * the defaults of the opened display with those of the current one.
 */
function inheritDisplayMacros(widgets: Widget[], macros: MacroScope): Widget[] {
  const { all, local } = macros;
  if (Object.keys(local).length === 0) return widgets;
  return widgets.map((w) => {
    const { macros: ownMacros, tabs, instances } = w.editableProperties;
    let editableProperties = w.editableProperties;
    if (ownMacros && INHERITS_MACRO_TABLE.has(w.widgetName)) {
      // own values were already resolved against `all` by the macro substitution
      editableProperties = {
        ...editableProperties,
        macros: { ...ownMacros, value: { ...local, ...ownMacros.value } },
      };
    }
    if (w.widgetName === "NavigationTabs" && tabs) {
      const value = tabs.value.map((tab) => ({
        ...tab,
        macros: { ...local, ...resolveMacroRecord(tab.macros, all) },
      }));
      editableProperties = { ...editableProperties, tabs: { ...tabs, value } };
    }
    if (w.widgetName === "DisplayRepeater" && instances) {
      const value = instances.value.map((inst) => ({
        macros: resolveMacroRecord(inst.macros, all),
      }));
      editableProperties = { ...editableProperties, instances: { ...instances, value } };
    }
    const children = w.children ? inheritDisplayMacros(w.children, macros) : undefined;
    if (editableProperties === w.editableProperties && children === w.children) return w;
    return { ...w, editableProperties, children };
  });
}
