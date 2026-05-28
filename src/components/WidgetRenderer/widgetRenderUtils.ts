// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { Widget } from "@src/types/widgets";
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
    const wPvName = w.editableProperties.pvName?.value;
    const wPvData = wPvName ? pvState[wPvName] : undefined;
    const wInternalMacros = buildInternalMacros(
      wPvName ? substituteInStr(wPvName, baseGridMacros) : undefined,
      wPvData,
    );
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
 * Merges PV data, macro substitutions, and rule overrides into every widget
 * in `editorWidgets`.  Returns the merged array and the new widget cache map
 * that should be stored back to `prevWidgetsMapRef` by the caller.
 */
export function computeWidgetsForRender(
  editorWidgets: Widget[],
  ctx: MergeWidgetContext,
): { result: Widget[]; nextWidgetsMap: Map<string, Widget> } {
  const { pvState, prevPVState, prevWidgetsMap, gridMacros, inEditMode } = ctx;
  const nextWidgetsMap = new Map<string, Widget>();

  const mergeWidget = (w: Widget): Widget => {
    if (inEditMode) {
      nextWidgetsMap.set(w.id, w);
      return w;
    }

    const pvName = w.editableProperties.pvName?.value;
    const pvNames = w.editableProperties.pvNames?.value;

    // Process children first so we can check child stability for the parent decision.
    const newChildren = w.children?.map(mergeWidget);

    // Check if PV data changed for this widget's own PVs and rule PVs.
    const rulePVsStable =
      !w.rules?.length ||
      w.rules.every(
        (r) =>
          r.pvNames.every((pv) => pvState[pv] === prevPVState[pv]) &&
          (typeof r.actions?.pvName !== "string" ||
            !r.actions.pvName ||
            pvState[r.actions.pvName] === prevPVState[r.actions.pvName]),
      );
    const ownPVsStable =
      (!pvName || pvState[pvName] === prevPVState[pvName]) &&
      (!pvNames?.length || pvNames.every((pv) => pvState[pv] === prevPVState[pv])) &&
      rulePVsStable;

    const childrenStable =
      !newChildren || newChildren.every((c, i) => c === prevWidgetsMap.get(w.children![i].id));

    // Check if the widget's own property structure changed.
    const prevWidget = prevWidgetsMap.get(w.id);
    const structureStable = prevWidget?.editableProperties === w.editableProperties;

    if (ownPVsStable && childrenStable && structureStable) {
      nextWidgetsMap.set(w.id, prevWidget);
      return prevWidget;
    }

    // Evaluate rules with the original pvName data so $(pvvalue) works in action values.
    const origPvData = pvName ? pvState[pvName] : undefined;
    const origInternalMacros = buildInternalMacros(
      pvName ? substituteInStr(pvName, gridMacros) : undefined,
      origPvData,
    );
    const origAllMacros =
      Object.keys(origInternalMacros).length > 0
        ? { ...gridMacros, ...origInternalMacros }
        : gridMacros;
    const ruleEvalMacros = pvName ? { ...origAllMacros, "$(pvname)": pvName } : origAllMacros;
    const ruleOverrides = evaluateRules(w.rules ?? [], pvState, ruleEvalMacros);

    // Derive effective pvName from rule override (if any).
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
      for (const pv of pvNames) {
        const d = pvState[pv];
        if (d) multiPvData[substituteInStr(pv, gridMacros)] = d;
      }
    }

    // Rebuild internal macros from effective pvName + effective pvData, then
    // apply macro substitution across all text properties.
    const merged: Widget = { ...w, pvData, multiPvData, children: newChildren };
    const internalMacros = buildInternalMacros(
      effectivePvName ? substituteInStr(effectivePvName, gridMacros) : undefined,
      pvData,
    );
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
