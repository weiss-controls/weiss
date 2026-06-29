// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type {
  Rule,
  RuleCondition,
  RuleOperator,
  PropertyKey,
  PropertyValue,
  Widget,
  RuleOverrides,
} from "@src/types/widgets";
import type { PVData } from "@src/types/epicsWS";
import { substituteMacroInStr as substituteMacroStr } from "@src/utils/macros";

/**
 * Evaluate a single condition against the current pvState.
 * Numeric comparison is used when both the PV value and the condition value
 * parse as finite numbers; otherwise string comparison is used.
 * Returns false if the PV is not yet available in pvState.
 */
function evaluateCondition(
  condition: RuleCondition,
  pvState: Record<string, PVData>,
  macros: Record<string, string>,
): boolean {
  const resolvedPVName = substituteMacroStr(condition.pvName, macros);
  const pvData = pvState[resolvedPVName];
  if (pvData === undefined) return false;

  const rawValue = pvData.value;
  if (rawValue === undefined || rawValue === null) return false;

  const pvStr = String(rawValue);
  const condStr = condition.value;

  // Attempt numeric comparison first
  const pvNum = Number(pvStr);
  const condNum = Number(condStr);
  const numeric = isFinite(pvNum) && isFinite(condNum);

  // For enum PVs: when the condition value is not numeric, resolve the PV integer
  // index to its label so that conditions like `== "Option 2"` work correctly.
  // When the condition IS numeric (e.g. `== 2`), index comparison runs as usual.
  const enumLabel: string | undefined =
    !numeric &&
    Number.isInteger(pvNum) &&
    pvNum >= 0 &&
    pvData.enumChoices != null &&
    pvNum < pvData.enumChoices.length
      ? pvData.enumChoices[pvNum]
      : undefined;

  const lhs = numeric ? pvNum : (enumLabel ?? pvStr);
  const rhs = numeric ? condNum : condStr;

  const op: RuleOperator = condition.operator;

  switch (op) {
    case "==":
      return lhs === rhs;
    case "!=":
      return lhs !== rhs;
    case ">":
      return lhs > rhs;
    case "<":
      return lhs < rhs;
    case ">=":
      return lhs >= rhs;
    case "<=":
      return lhs <= rhs;
    default:
      return false;
  }
}

/**
 * Evaluate a rule against the current pvState.
 * Returns true if the rule's conditions are satisfied according to its conditionLogic.
 * A rule with no conditions never matches.
 */
function evaluateRule(
  rule: Rule,
  pvState: Record<string, PVData>,
  macros: Record<string, string>,
): boolean {
  if (rule.conditions.length === 0) return false;

  if ((rule.conditionLogic ?? "AND") === "AND") {
    return rule.conditions.every((c) => evaluateCondition(c, pvState, macros));
  } else {
    return rule.conditions.some((c) => evaluateCondition(c, pvState, macros));
  }
}

/**
 * Evaluate all rules for a widget and return the merged property overrides.
 * Rules are applied in order; later rules win on same-property conflicts.
 * Returns an empty object if no rules match.
 *
 * @param rules - The widget's rule list
 * @param pvState - The current PV state from EpicsWSContext
 */
export function evaluateRules(
  rules: Rule[],
  pvState: Record<string, PVData>,
  macros: Record<string, string> = {},
): RuleOverrides {
  const overrides: RuleOverrides = {};

  for (const rule of rules) {
    if (evaluateRule(rule, pvState, macros)) {
      for (const [key, value] of Object.entries(rule.actions)) {
        if (typeof value === "string") {
          overrides[key as PropertyKey] = substituteMacroStr(value, macros);
        } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
          // Record<string,string> delta (e.g. globalMacros partial override)
          overrides[key as PropertyKey] = Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, substituteMacroStr(v, macros)]),
          ) as PropertyValue;
        } else {
          overrides[key as PropertyKey] = value;
        }
      }
    }
  }

  return overrides;
}

export function applyRules(w: Widget, overrides: RuleOverrides): Widget {
  return {
    ...w,
    editableProperties: Object.fromEntries(
      Object.entries(w.editableProperties).map(([key, prop]) => {
        const override = overrides[key as keyof RuleOverrides];
        if (override === undefined) return [key, prop];
        if (key === "macros" && typeof override === "object" && !Array.isArray(override)) {
          return [
            key,
            { ...prop, value: { ...(prop.value as Record<string, string>), ...override } },
          ];
        }
        return [key, { ...prop, value: override }];
      }),
    ) as typeof w.editableProperties,
  };
}
