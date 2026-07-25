// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { flattenWidgetTree } from "@src/context/widgetHelpers";
import type { PVData } from "@src/types/epicsWS";
import type { PropertyKey, Widget, WidgetProperties, WidgetProperty } from "@src/types/widgets";
import { evaluateRules } from "./ruleEngine";

/**
 * Substitute $(MACRO_NAME) patterns in a single string using a macros map.
 * Unresolved macros (no matching key) are left as-is.
 */
export function substituteMacroInStr(str: string, macros: Record<string, string>): string {
  if (!str.includes("$(")) return str; // skip regex search if str has no macros at all
  return str.replace(/\$\(([^)]+)\)/g, (match) => macros[match] ?? match);
}

/**
 * Build the built-in per-widget macro map from runtime PV data.
 * Keys follow the same $(NAME) convention as user macros so they flow
 * through substituteMacroInStr / substituteTextProps unchanged.
 * e.g.: $(pvname), $(pvdesc), $(pvvalue)
 *
 * @param substitutedPVName The widget's PV name after user macros are applied.
 * @param pvData            Resolved PV data for this widget (may be undefined).
 */
export function buildRuntimeMacros(
  substitutedPVName: string | undefined,
  pvData: PVData | undefined,
): Record<string, string> {
  const macros: Record<string, string> = {};
  macros["$(pvname)"] = substitutedPVName ?? "Unknown PV name";
  macros["$(pvdesc)"] = pvData?.display?.description ?? "";
  macros["$(pvunits)"] = pvData?.display?.units ?? "";
  if (pvData?.value !== undefined)
    macros["$(pvvalue)"] = Array.isArray(pvData.value)
      ? "pvvalue macro not supported for arrays"
      : String(pvData.value);
  else {
    macros["$(pvvalue)"] = "";
  }
  return macros;
}

/**
 * Return a copy of the given properties with macros substituted in every
 * property whose selType is "text".  All other properties are returned
 * unchanged (same object references).
 */
export function substituteTextProps(
  props: WidgetProperties,
  macros: Record<string, string>,
): WidgetProperties {
  if (Object.keys(macros).length === 0) return props;

  const result: WidgetProperties = {};
  const resultRecord = result as Record<PropertyKey, WidgetProperty>;
  let changed = false;
  for (const key of Object.keys(props) as PropertyKey[]) {
    const prop = props[key];
    if (!prop) {
      continue;
    }
    if (prop.selType === "text" && typeof prop.value === "string") {
      const substituted = substituteMacroInStr(prop.value, macros);
      if (substituted !== prop.value) {
        resultRecord[key] = { ...prop, value: substituted };
        changed = true;
      } else {
        resultRecord[key] = prop;
      }
    } else if (prop.selType === "strList" && Array.isArray(prop.value)) {
      const original = prop.value as string[];
      const substituted = original.map((s) => substituteMacroInStr(s, macros));
      if (substituted.some((s, i) => s !== original[i])) {
        resultRecord[key] = { ...prop, value: substituted };
        changed = true;
      } else {
        resultRecord[key] = prop;
      }
    } else {
      resultRecord[key] = prop;
    }
  }
  return changed ? result : props;
}

/**
 * Walks every widget in the tree (including nested children), evaluates their
 * rules against the current PV state, and aggregates any `globalMacros` action
 * values into a single map.
 */
export function collectGlobalMacroOverrides(
  widgets: Widget[],
  pvState: Record<string, PVData>,
  baseGlobalMacros: Record<string, string>,
): Record<string, string> {
  let overrides: Record<string, string> = {};
  for (const w of flattenWidgetTree(widgets)) {
    if (!w.rules?.length) continue;
    const hasGlobMacroRule = w.rules.some((r) => r.actions.globalMacros !== undefined);
    if (!hasGlobMacroRule) continue;
    const wPvName = w.runtimePVName;
    const wPvData = wPvName ? pvState[wPvName] : undefined;
    const wInternalMacros = buildRuntimeMacros(wPvName, wPvData);
    const wMacros =
      Object.keys(wInternalMacros).length > 0
        ? { ...baseGlobalMacros, ...wInternalMacros }
        : baseGlobalMacros;
    const wRuleEvalMacros = wPvName ? { ...wMacros, "$(pvname)": wPvName } : wMacros;
    const wOverrides = evaluateRules(w.rules, pvState, wRuleEvalMacros);
    if (wOverrides.globalMacros && typeof wOverrides.globalMacros === "object") {
      overrides = { ...overrides, ...(wOverrides.globalMacros as Record<string, string>) };
    }
  }
  return overrides;
}
