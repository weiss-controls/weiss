// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { Widget } from "@src/types/widgets";
import type { PVData } from "@src/types/epicsWS";
import { buildRuntimeMacros, substituteTextProps } from "@src/utils/macros";
import { applyRules, evaluateRules } from "@src/utils/ruleEngine";

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
  runtimeData: Record<string, PVData>,
  globalMacros: Record<string, string>,
): Widget {
  const pvName = w.runtimePVName;
  const pvNames = w.runtimePVNames;

  /**
   * TODO: this should be split into multiple functions.
   * So far, workflow is:
   * 1 - Apply received pvData (before rules)
   * 2 - Populate internal content ($(pvname), $(pvvalue), etc)
   * 3 - Evaluate rules against these.
   * 4 - If the rules change the PV name, re-populate internal content
   * 5 - Replace macros present in all text fields
   * 6 - Apply rule overrides to widget and return it
   * */
  // Build macros for rule evaluation using the widget's primary PV.
  const origPvData = pvName ? runtimeData[pvName] : undefined;
  const origInternalMacros = buildRuntimeMacros(pvName, origPvData);
  let allMacros =
    Object.keys(origInternalMacros).length > 0
      ? { ...globalMacros, ...origInternalMacros }
      : globalMacros;
  const ovr = evaluateRules(w.rules ?? [], runtimeData, allMacros);
  // skip globalMacros rules — handled globally for all widgets
  const ruleOverrides = Object.fromEntries(
    Object.entries(ovr).filter(([k]) => k !== "globalMacros"),
  );
  // Derive effective pvName from a rule override, if any.
  const effectivePvName =
    typeof ruleOverrides.pvName === "string" && ruleOverrides.pvName
      ? ruleOverrides.pvName
      : pvName;

  const pvData = effectivePvName ? runtimeData[effectivePvName] : undefined;
  let multiPvData: Record<string, PVData> | undefined;
  if (pvNames?.length) {
    multiPvData = {};
    for (const resolved of pvNames) {
      const d = runtimeData[resolved];
      if (d) multiPvData[resolved] = d;
    }
  }

  const withPVData: Widget = { ...w, pvData, multiPvData };

  if (effectivePvName !== pvName) {
    /**
     * In case PV name was changed by rules,
     * update content that depend on the live PV value ($(pvvalue), $(pvdesc)).
     * */
    const internalMacros = buildRuntimeMacros(effectivePvName, pvData);
    allMacros =
      Object.keys(internalMacros).length > 0
        ? { ...globalMacros, ...internalMacros }
        : globalMacros;
  }
  // Replace macro content in all properties with text (labels, axis title, tooltip, etc)
  const substitutedProps = substituteTextProps(withPVData.editableProperties, allMacros);
  const substituted: Widget = { ...withPVData, editableProperties: substitutedProps };
  const finalWidget = Object.keys(ruleOverrides).length
    ? applyRules(substituted, ruleOverrides)
    : substituted;
  return finalWidget;
}
