// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { Widget } from "@src/types/widgets";
import type { PVData } from "@src/types/epicsWS";
import { buildInternalMacros, substituteTextProps } from "@src/utils/macros";
import { evaluateRules } from "@src/utils/ruleEngine";

// Selection helpers
export const hasSelectedDescendant = (w: Widget, selectedIDs: string[]): boolean =>
  !!w.children?.some((c) => selectedIDs.includes(c.id) || hasSelectedDescendant(c, selectedIDs));

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
 * widget's text properties (e.g. labels, axis name, tooltip, etc).
 */
export function applyGlobalMacros(
  editorWidgets: Widget[],
  globalMacros: Record<string, string>,
): {
  applied: Widget[];
} {
  const applyMacrosRecursive = (w: Widget): Widget => {
    const newChildren = w.children?.map(applyMacrosRecursive);
    const substitutedProps = substituteTextProps(w.editableProperties, globalMacros);
    const merged: Widget = { ...w, editableProperties: substitutedProps, children: newChildren };
    return merged;
  };

  const applied = editorWidgets.map(applyMacrosRecursive);
  return { applied };
}
