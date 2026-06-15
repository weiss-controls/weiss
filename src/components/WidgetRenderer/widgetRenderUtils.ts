// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { Widget, Rule } from "@src/types/widgets";
import type { PVData } from "@src/types/epicsWS";
import { flattenWidgetTree } from "@src/context/widgetHelpers";
import { buildInternalMacros, substituteInStr, substituteTextProps } from "@src/utils/macros";
import { evaluateRules } from "@src/utils/ruleEngine";

// Selection helpers
export const hasSelectedDescendant = (w: Widget, selectedIDs: string[]): boolean =>
  !!w.children?.some((c) => selectedIDs.includes(c.id) || hasSelectedDescendant(c, selectedIDs));

// globalMacros override computation

/**
 * Iterates every widget in the tree (including nested children), evaluates
 * their rules, and merges any `globalMacros` action deltas into a single map.
 *
 * Called inside a useMemo in WidgetRenderer — the `inEditMode` short-circuit
 * guard lives there so this function is always called in runtime mode only.
 */
export function computeGlobalMacrosOverrides(
  widgets: Widget[],
  pvState: Record<string, PVData>,
  baseGridMacros: Record<string, string>,
): Record<string, string> {
  let merged: Record<string, string> = {};
  for (const w of flattenWidgetTree(widgets)) {
    if (!w.rules?.length) continue;
    const wPvName = w.runtimePVName;
    const wPvData = wPvName ? pvState[wPvName] : undefined;
    const wInternalMacros = buildInternalMacros(wPvName, wPvData);
    const wMacros =
      Object.keys(wInternalMacros).length > 0
        ? { ...baseGridMacros, ...wInternalMacros }
        : baseGridMacros;
    const wRuleEvalMacros = wPvName ? { ...wMacros, "$(pvname)": wPvName } : wMacros;
    const wOverrides = evaluateRules(w.rules, pvState, wRuleEvalMacros);
    if (wOverrides.globalMacros && typeof wOverrides.globalMacros === "object") {
      merged = { ...merged, ...(wOverrides.globalMacros as Record<string, string>) };
    }
  }
  return merged;
}

// Per-widget merge (PV data + macro substitution + rule overrides)
export interface MergeWidgetContext {
  pvState: Record<string, PVData>;
  prevPVState: Record<string, PVData>;
  prevWidgetsMap: Map<string, Widget>;
  gridMacros: Record<string, string>;
  inEditMode: boolean;
}

/**
 * Returns the previously cached `Widget` if nothing relevant changed (PV data,
 * children, own property structure), or `undefined` if the widget needs to be
 * recomputed.
 */
const getStableWidget = (
  w: Widget,
  ctx: MergeWidgetContext,
  newChildren: Widget[] | undefined,
): Widget | undefined => {
  const { pvState, prevPVState, prevWidgetsMap, gridMacros } = ctx;
  const pvName = w.runtimePVName;
  const pvNames = w.runtimePVNames;

  const ruleConditionPVsStable = (r: Rule) =>
    r.pvNames.every((pv: string) => {
      const resolved = substituteInStr(pv, gridMacros);
      return pvState[resolved] === prevPVState[resolved];
    });
  const ruleActionPVStable = (r: Rule) => {
    const actionPV = r.actions?.pvName;
    return typeof actionPV !== "string" || !actionPV || pvState[actionPV] === prevPVState[actionPV];
  };

  const rulePVsStable =
    !w.rules?.length || w.rules.every((r) => ruleConditionPVsStable(r) && ruleActionPVStable(r));
  const ownPVsStable =
    (!pvName || pvState[pvName] === prevPVState[pvName]) &&
    (!pvNames?.length || pvNames.every((pv) => pvState[pv] === prevPVState[pv])) &&
    rulePVsStable;
  const childrenStable =
    !newChildren || newChildren.every((c, i) => c === prevWidgetsMap.get(w.children![i].id));

  const prevWidget = prevWidgetsMap.get(w.id);
  const structureStable = prevWidget?.editableProperties === w.editableProperties;

  return ownPVsStable && childrenStable && structureStable ? prevWidget : undefined;
};

/**
 * Merges PV data, macro substitutions, and rule overrides into every widget
 * in `editorWidgets`.  Returns the merged array and the new widget cache map
 * that should be stored back to `prevWidgetsMapRef` by the caller.
 */
export function computeWidgetsForRender(
  editorWidgets: Widget[],
  ctx: MergeWidgetContext,
): { result: Widget[]; nextWidgetsMap: Map<string, Widget> } {
  const { pvState, gridMacros, inEditMode } = ctx;
  const nextWidgetsMap = new Map<string, Widget>();

  const mergeWidget = (w: Widget): Widget => {
    if (inEditMode) {
      nextWidgetsMap.set(w.id, w);
      return w;
    }
    const pvName = w.runtimePVName;
    const pvNames = w.runtimePVNames;

    // Process children first so we can check child stability for the parent decision.
    const newChildren = w.children?.map(mergeWidget);

    const stableWidget = getStableWidget(w, ctx, newChildren);
    if (stableWidget) {
      nextWidgetsMap.set(w.id, stableWidget);
      return stableWidget;
    }

    // Evaluate rules using the widget's resolved PV name so $(pvvalue) works in action values.
    const origPvData = pvName ? pvState[pvName] : undefined;
    const origInternalMacros = buildInternalMacros(pvName, origPvData);
    const origAllMacros =
      Object.keys(origInternalMacros).length > 0
        ? { ...gridMacros, ...origInternalMacros }
        : gridMacros;
    const ruleEvalMacros = pvName ? { ...origAllMacros, "$(pvname)": pvName } : origAllMacros;
    const ruleOverrides = evaluateRules(w.rules ?? [], pvState, ruleEvalMacros);

    // Derive effective pvName from rule override (if any); it is already resolved.
    const effectivePvName =
      typeof ruleOverrides.pvName === "string" && ruleOverrides.pvName
        ? ruleOverrides.pvName
        : pvName;

    // Look up pvData using the effective pvName.
    let pvData: PVData | undefined;
    let multiPvData: Record<string, PVData> | undefined;

    if (effectivePvName) {
      pvData = pvState[effectivePvName];
    }
    if (pvNames?.length) {
      multiPvData = {};
      for (const resolved of pvNames) {
        const d = pvState[resolved];
        if (d) multiPvData[resolved] = d;
      }
    }

    // Build internal macros from effective pvName (already resolved) + pvData.
    const merged: Widget = { ...w, pvData, multiPvData, children: newChildren };
    const internalMacros = buildInternalMacros(effectivePvName, pvData);
    const allMacros =
      Object.keys(internalMacros).length > 0 ? { ...gridMacros, ...internalMacros } : gridMacros;
    const mergedWithMacros: Widget = {
      ...merged,
      editableProperties: substituteTextProps(merged.editableProperties, allMacros),
    };

    // Apply per-widget rule overrides to editableProperties:
    // - globalMacros: consumed by computeGlobalMacrosOverrides, not applied here.
    // - macros: merge delta into existing value rather than replacing wholesale.
    // - all others: plain value replacement.
    const perWidgetOverrides = Object.fromEntries(
      Object.entries(ruleOverrides).filter(([k]) => k !== "globalMacros"),
    );
    const hasOverrides = Object.keys(perWidgetOverrides).length > 0;
    const withRules: Widget = hasOverrides
      ? {
          ...mergedWithMacros,
          editableProperties: Object.fromEntries(
            Object.entries(mergedWithMacros.editableProperties).map(([key, prop]) => {
              const override = perWidgetOverrides[key as keyof typeof perWidgetOverrides];
              if (override === undefined) return [key, prop];
              if (key === "macros" && typeof override === "object" && !Array.isArray(override)) {
                return [
                  key,
                  {
                    ...prop,
                    value: {
                      ...(prop.value as Record<string, string>),
                      ...override,
                    },
                  },
                ];
              }
              return [key, { ...prop, value: override }];
            }),
          ) as typeof mergedWithMacros.editableProperties,
        }
      : mergedWithMacros;

    nextWidgetsMap.set(w.id, withRules);
    return withRules;
  };

  const result = editorWidgets.map(mergeWidget);
  return { result, nextWidgetsMap };
}
