// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { flattenWidgetTree } from "@src/context/widgetHelpers";
import type { PVData } from "@src/types/epicsWS";
import type { PropertyKey, Widget, WidgetProperties, WidgetProperty } from "@src/types/widgets";
import { evaluateRules } from "./ruleEngine";

const MACRO_TOKEN_PATTERN = /^\$\([^)]+\)$/;

function normalizeMacroKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return trimmed;
  return MACRO_TOKEN_PATTERN.test(trimmed) ? trimmed : `$(${trimmed})`;
}

function isConcreteMacroValue(value: string): boolean {
  return !value.includes("$(");
}

/**
 * Substitute $(MACRO_NAME) patterns in a single string using a macros map.
 * Unresolved macros (no matching key) are left as-is.
 */
export function substituteMacroInStr(str: string, macros: Record<string, string>): string {
  if (!str.includes("$(")) return str; // skip regex search if str has no macros at all
  return str.replace(/\$\(([^)]+)\)/g, (match) => macros[match] ?? match);
}

/**
 * Build the forwarded navigation macro layer from the current runtime base macros
 * and a clicked button macro map.
 *
 * - Existing runtime macros are forwarded by default.
 * - New button entries override duplicates when they resolve to concrete values.
 * - If a new value remains unresolved (e.g. "$(A)"), it does not clobber an
 *   already concrete value for that key.
 */
export function composeForwardNavigationMacros(
  runtimeBaseMacros: Record<string, string>,
  buttonMacros: Record<string, string>,
): Record<string, string> {
  const forwarded: Record<string, string> = { ...runtimeBaseMacros };

  for (const [rawKey, rawValue] of Object.entries(buttonMacros)) {
    const normalizedKey = normalizeMacroKey(rawKey);
    if (!normalizedKey) continue;

    const previousValue = forwarded[normalizedKey];
    const resolvedValue = substituteMacroInStr(rawValue, forwarded);
    const unresolvedIncoming = !isConcreteMacroValue(resolvedValue);
    const hadConcreteValue =
      typeof previousValue === "string" && isConcreteMacroValue(previousValue);

    if (unresolvedIncoming && hadConcreteValue) {
      continue;
    }

    forwarded[normalizedKey] = resolvedValue;
  }

  return forwarded;
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
    if (key === "macros") {
      // Substitute possible macros in the macros values (e.g. embedded screens)
      const original = prop.value as Record<string, string>;
      const substituted: Record<string, string> = {};
      let macrosChanged = false;
      for (const macroKey of Object.keys(original)) {
        const macroValue = original[macroKey];
        const substitutedValue = substituteMacroInStr(macroValue, macros);
        substituted[macroKey] = substitutedValue;
        if (substitutedValue !== macroValue) {
          macrosChanged = true;
        }
        resultRecord[key] = macrosChanged ? { ...prop, value: substituted } : prop;
        changed ||= macrosChanged;
      }
    } else if (prop.selType === "text" && typeof prop.value === "string") {
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
 * Recursively substitute macros in widget properties and rule pv targets.
 * Intended for cases where a whole widget subtree needs macro expansion
 * (e.g. Embedded Display children) while preserving unchanged references
 * whenever possible.
 */
export function substituteMacrosInWidgetTree(
  widgets: Widget[],
  macros: Record<string, string>,
): Widget[] {
  if (Object.keys(macros).length === 0) return widgets;

  let anyChanged = false;
  const updatedWidgets = widgets.map((w) => {
    let editableProperties = substituteTextProps(w.editableProperties, macros);
    let rules = w.rules;
    let changed = editableProperties !== w.editableProperties;

    if (editableProperties.pvName?.value) {
      const oldPVName = editableProperties.pvName.value;
      const newPVName = substituteMacroInStr(oldPVName, macros);
      if (newPVName !== oldPVName) {
        editableProperties = {
          ...editableProperties,
          pvName: { ...editableProperties.pvName, value: newPVName },
        };
        changed = true;
      }
    }

    if (editableProperties.pvNames?.value && editableProperties.pvNames.value.length > 0) {
      const original = editableProperties.pvNames.value;
      const substituted = original.map((pv) => substituteMacroInStr(pv, macros));
      if (substituted.some((pv, idx) => pv !== original[idx])) {
        editableProperties = {
          ...editableProperties,
          pvNames: { ...editableProperties.pvNames, value: substituted },
        };
        changed = true;
      }
    }

    if (w.rules?.length) {
      let rulesChanged = false;
      const nextRules = w.rules.map((r) => {
        let ruleChanged = false;

        const nextConditions = r.conditions.map((c) => {
          const nextPVName = substituteMacroInStr(c.pvName, macros);
          if (nextPVName !== c.pvName) {
            ruleChanged = true;
            return { ...c, pvName: nextPVName };
          }
          return c;
        });

        const nextPVNames = r.pvNames.map((pv) => {
          const nextPV = substituteMacroInStr(pv, macros);
          if (nextPV !== pv) {
            ruleChanged = true;
          }
          return nextPV;
        });

        let nextActions = r.actions;
        const actionPVName = r.actions?.pvName;
        if (typeof actionPVName === "string") {
          const nextActionPVName = substituteMacroInStr(actionPVName, macros);
          if (nextActionPVName !== actionPVName) {
            nextActions = { ...r.actions, pvName: nextActionPVName };
            ruleChanged = true;
          }
        }

        if (!ruleChanged) return r;
        rulesChanged = true;
        return {
          ...r,
          conditions: nextConditions,
          pvNames: nextPVNames,
          actions: nextActions,
        };
      });

      if (rulesChanged) {
        rules = nextRules;
        changed = true;
      }
    }

    const children = w.children ? substituteMacrosInWidgetTree(w.children, macros) : undefined;
    if (children && children !== w.children) {
      changed = true;
    }

    if (!changed) return w;

    anyChanged = true;
    return {
      ...w,
      editableProperties,
      children,
      rules,
    };
  });

  return anyChanged ? updatedWidgets : widgets;
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
