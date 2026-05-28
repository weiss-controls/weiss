// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { v4 as uuidv4 } from "uuid";
import type { Rule, RuleCondition, RuleOperator } from "@src/types/widgets";

export const OPERATORS: RuleOperator[] = ["==", "!=", ">", "<", ">=", "<="];

// Properties that can be targeted by a rule action (exclude layout/meta, keep style/text)
export const ACTIONABLE_SEL_TYPES = new Set([
  "text",
  "number",
  "boolean",
  "colorSel",
  "select",
  "strRecord",
]);

export function makeEmptyCondition(): RuleCondition {
  return { pvName: "$(pvname)", operator: "==", value: "" };
}

export function makeEmptyRule(): Rule {
  return {
    id: uuidv4(),
    name: "New rule",
    pvNames: [],
    conditionLogic: "AND",
    conditions: [makeEmptyCondition()],
    actions: {},
  };
}

/** Derive the ordered list of PVs referenced by all conditions of a rule. */
export function derivePVNames(conditions: RuleCondition[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const c of conditions) {
    if (c.pvName && !seen.has(c.pvName)) {
      seen.add(c.pvName);
      result.push(c.pvName);
    }
  }
  return result;
}
