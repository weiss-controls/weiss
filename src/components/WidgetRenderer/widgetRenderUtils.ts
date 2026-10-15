// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { RuleOverrides, Widget } from "@src/types/widgets";
import type { PVData } from "@src/types/epicsWS";
import { buildRuntimeMacros, substituteTextProps } from "@src/utils/macros";
import { applyRules, evaluateRules } from "@src/utils/ruleEngine";

// Selection helpers
export const hasSelectedDescendant = (w: Widget, selectedIDs: string[]): boolean =>
  !!w.children?.some((c) => selectedIDs.includes(c.id) || hasSelectedDescendant(c, selectedIDs));

/** Merge widget runtime macros ($(pvname), $(pvvalue), etc.) on top of global macros. */
function buildRuleEvalMacros(
  globalMacros: Record<string, string>,
  pvName: string | undefined,
  pvData: PVData | undefined,
): Record<string, string> {
  const runtimeMacros = buildRuntimeMacros(pvName, pvData);
  return Object.keys(runtimeMacros).length > 0
    ? { ...globalMacros, ...runtimeMacros }
    : globalMacros;
}

/** Evaluate widget rules and drop globalMacros actions (handled at grid level). */
function evalWidgetRules(
  w: Widget,
  runtimeData: Record<string, PVData>,
  macros: Record<string, string>,
): RuleOverrides {
  const overrides = evaluateRules(w.rules ?? [], runtimeData, macros);
  return Object.fromEntries(
    Object.entries(overrides).filter(([k]) => k !== "globalMacros"),
  ) as RuleOverrides;
}

/** Pick the effective primary PV after applying rule overrides. */
function pickPvName(pvName: string | undefined, ruleOverrides: RuleOverrides) {
  return typeof ruleOverrides.pvName === "string" && ruleOverrides.pvName
    ? ruleOverrides.pvName
    : pvName;
}

/** Resolve live PV payload for primary and multi-PV bindings. */
function bindPvData(
  runtimeData: Record<string, PVData>,
  pvName: string | undefined,
  pvNames: string[] | undefined,
) {
  const pvData = pvName ? runtimeData[pvName] : undefined;
  let multiPvData: Record<string, PVData> | undefined;

  if (pvNames?.length) {
    multiPvData = {};
    for (const resolved of pvNames) {
      const data = runtimeData[resolved];
      if (data) multiPvData[resolved] = data;
    }
  }

  return { pvData, multiPvData };
}

/** Apply macro substitution in all text-like properties. */
function applyTextMacros(w: Widget, macros: Record<string, string>): Widget {
  const editableProperties = substituteTextProps(w.editableProperties, macros);
  return editableProperties === w.editableProperties ? w : { ...w, editableProperties };
}

/** Apply rule overrides only when at least one override exists. */
function applyRuleOverrides(w: Widget, ruleOverrides: RuleOverrides): Widget {
  return Object.keys(ruleOverrides).length > 0 ? applyRules(w, ruleOverrides) : w;
}

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
  const initialPvName = w.runtimePVName;
  const pvNames = w.runtimePVNames;

  const initialPvData = initialPvName ? runtimeData[initialPvName] : undefined;
  let ruleEvalMacros = buildRuleEvalMacros(globalMacros, initialPvName, initialPvData);
  const ruleOverrides = evalWidgetRules(w, runtimeData, ruleEvalMacros);

  const effectivePvName = pickPvName(initialPvName, ruleOverrides);
  const { pvData, multiPvData } = bindPvData(runtimeData, effectivePvName, pvNames);
  const withPv = { ...w, pvData, multiPvData };

  // If a rule changed pvName, rebuild runtime macros from the effective PV.
  if (effectivePvName !== initialPvName) {
    ruleEvalMacros = buildRuleEvalMacros(globalMacros, effectivePvName, pvData);
  }

  const withText = applyTextMacros(withPv, ruleEvalMacros);
  const finalWidget = applyRuleOverrides(withText, ruleOverrides);
  return finalWidget;
}
