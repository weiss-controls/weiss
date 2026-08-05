// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { v4 as uuidv4 } from "uuid";
import { PROPERTY_SCHEMAS } from "@src/types/widgetProperties";
import type {
  ExportedRule,
  ExportedRuleSet,
  LegacyExportedRule,
  PropertyKey,
  Rule,
  RuleCondition,
  RuleOperator,
  RuleSet,
} from "@src/types/widgets";

function isRuleOperator(value: string): value is RuleOperator {
  return (
    value === "==" ||
    value === "!=" ||
    value === ">" ||
    value === "<" ||
    value === ">=" ||
    value === "<="
  );
}

function normalizeCondition(raw: unknown): RuleCondition | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<RuleCondition>;
  if (typeof c.pvName !== "string") return null;
  if (typeof c.value !== "string") return null;
  const operator: RuleOperator =
    typeof c.operator === "string" && isRuleOperator(c.operator) ? c.operator : "==";
  return {
    pvName: c.pvName,
    operator,
    value: c.value,
  };
}

function derivePVNames(conditions: RuleCondition[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const condition of conditions) {
    if (condition.pvName && !seen.has(condition.pvName)) {
      seen.add(condition.pvName);
      ordered.push(condition.pvName);
    }
  }
  return ordered;
}

function normalizeRuleset(raw: Partial<ExportedRuleSet>): RuleSet {
  const conditions = (raw.conditions ?? [])
    .map(normalizeCondition)
    .filter((c): c is RuleCondition => c !== null);
  return {
    id: uuidv4(),
    pvNames: derivePVNames(conditions),
    conditionLogic: raw.conditionLogic === "OR" ? "OR" : "AND",
    conditions,
    value: raw.value ?? "",
  };
}

function parseNewRule(raw: Partial<ExportedRule>): Rule[] {
  if (typeof raw.targetProperty !== "string") return [];
  if (!(raw.targetProperty in PROPERTY_SCHEMAS)) return [];
  const targetProperty = raw.targetProperty;

  const rawRulesets: Partial<ExportedRuleSet>[] = Array.isArray(raw.rulesets) ? raw.rulesets : [];
  const rulesets = rawRulesets.map(normalizeRuleset);
  return [
    {
      id: uuidv4(),
      name: typeof raw.name === "string" && raw.name.length > 0 ? raw.name : "Imported rule",
      targetProperty,
      rulesets,
    },
  ];
}

function parseLegacyRule(raw: Partial<LegacyExportedRule>): Rule[] {
  const conditions = (raw.conditions ?? [])
    .map(normalizeCondition)
    .filter((c): c is RuleCondition => c !== null);
  const conditionLogic = raw.conditionLogic === "OR" ? "OR" : "AND";
  const actions = raw.actions ?? {};

  const imported: Rule[] = [];
  for (const [key, value] of Object.entries(actions)) {
    const targetProperty = key as PropertyKey;
    if (!PROPERTY_SCHEMAS[targetProperty]) continue;

    imported.push({
      id: uuidv4(),
      name: typeof raw.name === "string" && raw.name.length > 0 ? raw.name : "Imported rule",
      targetProperty,
      rulesets: [
        {
          id: uuidv4(),
          pvNames: derivePVNames(conditions),
          conditionLogic,
          conditions,
          value,
        },
      ],
    });
  }

  return imported;
}

/**
 * Parses serialized rules from .opi files.
 * Supports both the new property-oriented format and the legacy actions format.
 */
export function parseSerializedRules(rawRules: unknown[] | undefined): Rule[] {
  if (!rawRules || rawRules.length === 0) return [];

  const parsed: Rule[] = [];
  for (const raw of rawRules) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as Partial<ExportedRule & LegacyExportedRule>;

    if (candidate.targetProperty !== undefined || candidate.rulesets !== undefined) {
      parsed.push(...parseNewRule(candidate));
      continue;
    }

    if (candidate.actions !== undefined || candidate.conditions !== undefined) {
      parsed.push(...parseLegacyRule(candidate));
    }
  }

  return parsed;
}

/**
 * Returns all PV references used by a rule rulesets, preserving first-seen order.
 */
export function collectRulePVNames(rule: Rule): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const ruleset of rule.rulesets) {
    for (const pv of ruleset.pvNames) {
      if (!pv || seen.has(pv)) continue;
      seen.add(pv);
      ordered.push(pv);
    }
  }

  return ordered;
}
