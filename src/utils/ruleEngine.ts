// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type {
  Rule,
  RuleCondition,
  RuleOperator,
  PropertyKey,
  PropertyValue,
} from "@src/types/widgets";
import type { PVData } from "@src/types/epicsWS";
import { substituteInStr as substituteMacroStr } from "@src/utils/macros";

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

  const lhs = numeric ? pvNum : pvStr;
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
): Partial<Record<PropertyKey, PropertyValue>> {
  const overrides: Partial<Record<PropertyKey, PropertyValue>> = {};

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
