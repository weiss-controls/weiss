// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type {
  Widget,
  Rule,
  WidgetProperties,
  WidgetProperty,
  PropertyKey,
} from "@src/types/widgets";
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
  prevRawPropsMap: Map<string, WidgetProperties>;
  gridMacros: Record<string, string>;
  prevGridMacros: Record<string, string>;
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
  const { pvState, prevPVState, prevWidgetsMap, prevRawPropsMap, gridMacros, prevGridMacros } = ctx;
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
  // Compare raw-to-raw: prevRawPropsMap holds the unsubstituted editableProperties from
  // the previous render, so this is not affected by substituteTextProps creating new objects.
  const structureStable = prevRawPropsMap.get(w.id) === w.editableProperties;
  // If gridMacros changed (e.g. a rule updated a globalMacro like $(IDX)), any widget
  // whose text props reference that macro must be recomputed even if its own PV and
  // raw props are unchanged.
  const macrosStable = gridMacros === prevGridMacros;

  return ownPVsStable && childrenStable && structureStable && macrosStable ? prevWidget : undefined;
};

/**
 * Merges PV data, macro substitutions, and rule overrides into every widget
 * in `editorWidgets`.  Returns the merged array and the new widget cache map
 * that should be stored back to `prevWidgetsMapRef` by the caller.
 */
export function computeWidgetsForRender(
  editorWidgets: Widget[],
  ctx: MergeWidgetContext,
): {
  result: Widget[];
  nextWidgetsMap: Map<string, Widget>;
  nextRawPropsMap: Map<string, WidgetProperties>;
} {
  const { pvState, gridMacros, inEditMode, prevWidgetsMap } = ctx;
  const nextWidgetsMap = new Map<string, Widget>();
  const nextRawPropsMap = new Map<string, WidgetProperties>();

  const mergeWidget = (w: Widget): Widget => {
    if (inEditMode) {
      nextWidgetsMap.set(w.id, w);
      nextRawPropsMap.set(w.id, w.editableProperties);
      return w;
    }
    const pvName = w.runtimePVName;
    const pvNames = w.runtimePVNames;

    // Process children first so we can check child stability for the parent decision.
    const newChildren = w.children?.map(mergeWidget);

    const stableWidget = getStableWidget(w, ctx, newChildren);
    if (stableWidget) {
      nextWidgetsMap.set(w.id, stableWidget);
      nextRawPropsMap.set(w.id, w.editableProperties);
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

    // Substitute macros in text properties, then stabilise the reference.
    //
    // For each prop where the reference changed, compare the substituted value against
    // the previous substituted value.  If the value is identical (same string / same array
    // elements), reuse the previous prop object so the reference stays stable.
    const prevSubstitutedProps = prevWidgetsMap.get(w.id)?.editableProperties;
    const freshSubstitutedProps = substituteTextProps(merged.editableProperties, allMacros);

    let substitutedProps: WidgetProperties;
    if (!prevSubstitutedProps || freshSubstitutedProps === merged.editableProperties) {
      // No previous state, or nothing was substituted: use as-is.
      substitutedProps = freshSubstitutedProps;
    } else {
      type PropsRecord = Record<PropertyKey, WidgetProperty>;
      const freshRec = freshSubstitutedProps as PropsRecord;
      const prevRec = prevSubstitutedProps as PropsRecord;
      const stabilized: PropsRecord = { ...freshRec };
      let anyRealChange = false;
      for (const k of Object.keys(freshRec) as PropertyKey[]) {
        const fp = freshRec[k];
        const pp = prevRec[k];
        if (fp === pp) continue; // reference already stable
        const fv = fp?.value;
        const pv = pp?.value;
        if (fv === pv) {
          // Same primitive value: reuse previous prop object.
          stabilized[k] = pp;
        } else if (
          Array.isArray(fv) &&
          Array.isArray(pv) &&
          fv.length === pv.length &&
          fv.every((x, i) => x === pv[i])
        ) {
          // Same array contents: reuse previous prop object.
          stabilized[k] = pp;
        } else {
          anyRealChange = true;
        }
      }
      // If all values were identical, return the exact previous container object so
      // that stability checks on editableProperties in downstream components pass.
      substitutedProps = anyRealChange
        ? (stabilized as unknown as WidgetProperties)
        : prevSubstitutedProps;
    }

    const mergedWithMacros: Widget = { ...merged, editableProperties: substitutedProps };

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
    nextRawPropsMap.set(w.id, w.editableProperties);
    return withRules;
  };

  const result = editorWidgets.map(mergeWidget);
  return { result, nextWidgetsMap, nextRawPropsMap };
}
