// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { Widget, WidgetProperties } from "@src/types/widgets";
import type { PVData } from "@src/types/epicsWS";
import { flattenWidgetTree } from "@src/context/widgetHelpers";
import { buildInternalMacros, substituteTextProps } from "@src/utils/macros";
import { evaluateRules } from "@src/utils/ruleEngine";

// Selection helpers
export const hasSelectedDescendant = (w: Widget, selectedIDs: string[]): boolean =>
  !!w.children?.some((c) => selectedIDs.includes(c.id) || hasSelectedDescendant(c, selectedIDs));

// globalMacros override computation

/**
 * Walks every widget in the tree (including nested children), evaluates their
 * rules against the current PV state, and aggregates any `globalMacros` action
 * values into a single merged map.  Called from the `usePVStore.subscribe()`
 * effect in WidgetRenderer; only runs in runtime mode.
 */
export function collectGlobalMacroOverrides(
  widgets: Widget[],
  pvState: Record<string, PVData>,
  baseGlobalMacros: Record<string, string>,
): Record<string, string> {
  let merged: Record<string, string> = {};
  for (const w of flattenWidgetTree(widgets)) {
    if (!w.rules?.length) continue;
    const wPvName = w.runtimePVName;
    const wPvData = wPvName ? pvState[wPvName] : undefined;
    const wInternalMacros = buildInternalMacros(wPvName, wPvData);
    const wMacros =
      Object.keys(wInternalMacros).length > 0
        ? { ...baseGlobalMacros, ...wInternalMacros }
        : baseGlobalMacros;
    const wRuleEvalMacros = wPvName ? { ...wMacros, "$(pvname)": wPvName } : wMacros;
    const wOverrides = evaluateRules(w.rules, pvState, wRuleEvalMacros);
    if (wOverrides.globalMacros && typeof wOverrides.globalMacros === "object") {
      merged = { ...merged, ...(wOverrides.globalMacros as Record<string, string>) };
    }
  }
  return merged;
}

/**
 * Injects live PV data into a single widget: resolves pvvalue/pvname macros,
 * evaluates per-widget rules, and applies their property overrides.
 * Skips `globalMacros` rule actions — those are handled at grid level by
 * `collectGlobalMacroOverrides`.
 *
 * Called inside `LiveWidget` with PV data from a per-widget Zustand
 * selector, so it only runs when the widget's own PVs change.
 */
export function applyWidgetPVData(
  w: Widget,
  relevantPvs: Record<string, PVData>,
  globalMacros: Record<string, string>,
): Widget {
  const pvName = w.runtimePVName;
  const pvNames = w.runtimePVNames;

  // Build macros for rule evaluation using the widget's primary PV.
  const origPvData = pvName ? relevantPvs[pvName] : undefined;
  const origInternalMacros = buildInternalMacros(pvName, origPvData);
  const origAllMacros =
    Object.keys(origInternalMacros).length > 0
      ? { ...globalMacros, ...origInternalMacros }
      : globalMacros;
  const ruleEvalMacros = pvName ? { ...origAllMacros, "$(pvname)": pvName } : origAllMacros;
  const ruleOverrides = evaluateRules(w.rules ?? [], relevantPvs, ruleEvalMacros);

  // Derive effective pvName from a rule override, if any.
  const effectivePvName =
    typeof ruleOverrides.pvName === "string" && ruleOverrides.pvName
      ? ruleOverrides.pvName
      : pvName;

  const pvData = effectivePvName ? relevantPvs[effectivePvName] : undefined;
  let multiPvData: Record<string, PVData> | undefined;
  if (pvNames?.length) {
    multiPvData = {};
    for (const resolved of pvNames) {
      const d = relevantPvs[resolved];
      if (d) multiPvData[resolved] = d;
    }
  }

  const withPVData: Widget = { ...w, pvData, multiPvData };

  // Re-substitute macros that depend on the live PV value ($(pvvalue), $(pvname)).
  const internalMacros = buildInternalMacros(effectivePvName, pvData);
  const allMacros =
    Object.keys(internalMacros).length > 0 ? { ...globalMacros, ...internalMacros } : globalMacros;
  const substitutedProps = substituteTextProps(withPVData.editableProperties, allMacros);
  const withMacros: Widget = { ...withPVData, editableProperties: substitutedProps };

  // Apply per-widget rule overrides (skip globalMacros — handled at grid level).
  const perWidgetOverrides = Object.fromEntries(
    Object.entries(ruleOverrides).filter(([k]) => k !== "globalMacros"),
  );
  if (!Object.keys(perWidgetOverrides).length) return withMacros;

  return {
    ...withMacros,
    editableProperties: Object.fromEntries(
      Object.entries(withMacros.editableProperties).map(([key, prop]) => {
        const override = perWidgetOverrides[key as keyof typeof perWidgetOverrides];
        if (override === undefined) return [key, prop];
        if (key === "macros" && typeof override === "object" && !Array.isArray(override)) {
          return [
            key,
            { ...prop, value: { ...(prop.value as Record<string, string>), ...override } },
          ];
        }
        return [key, { ...prop, value: override }];
      }),
    ) as typeof withMacros.editableProperties,
  };
}

/**
 * Substitutes grid macros (design-time + rule-driven overrides) into every
 * widget's text properties.  Results are cached by raw `editableProperties`
 * reference and `globalMacros` reference, so unchanged widgets are returned
 * as stable object references, preventing unnecessary `LiveWidget`
 * re-renders.  PV data injection and per-widget rule evaluation are
 * deliberately omitted; those happen inside `LiveWidget`.
 */
export function applyGlobalMacros(
  editorWidgets: Widget[],
  globalMacros: Record<string, string>,
  inEditMode: boolean,
  prevWidgetsMap: Map<string, Widget>,
  prevRawPropsMap: Map<string, WidgetProperties>,
  prevGlobalMacros: Record<string, string>,
): {
  result: Widget[];
  nextWidgetsMap: Map<string, Widget>;
  nextRawPropsMap: Map<string, WidgetProperties>;
} {
  const nextWidgetsMap = new Map<string, Widget>();
  const nextRawPropsMap = new Map<string, WidgetProperties>();

  const mergeLayout = (w: Widget): Widget => {
    nextRawPropsMap.set(w.id, w.editableProperties);

    if (inEditMode) {
      nextWidgetsMap.set(w.id, w);
      return w;
    }

    const newChildren = w.children?.map(mergeLayout);

    // Return cached widget if nothing changed.
    // globalMacros reference equality: if macros changed, recompute unconditionally.
    const macrosStable = globalMacros === prevGlobalMacros;
    const structureStable = prevRawPropsMap.get(w.id) === w.editableProperties;
    const childrenStable =
      !newChildren || newChildren.every((c, i) => c === prevWidgetsMap.get(w.children![i].id));
    if (macrosStable && structureStable && childrenStable) {
      const cached = prevWidgetsMap.get(w.id);
      if (cached) {
        nextWidgetsMap.set(w.id, cached);
        return cached;
      }
    }

    const substitutedProps = substituteTextProps(w.editableProperties, globalMacros);
    const merged: Widget = { ...w, editableProperties: substitutedProps, children: newChildren };
    nextWidgetsMap.set(w.id, merged);
    return merged;
  };

  const result = editorWidgets.map(mergeLayout);
  return { result, nextWidgetsMap, nextRawPropsMap };
}
