// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { memo, useMemo, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import WidgetRegistry from "@components/WidgetRegistry/WidgetRegistry";
import type { Widget } from "@src/types/widgets";
import type { PVData } from "@src/types/epicsWS";
import { usePVStore } from "@src/stores/pvStore";
import { substituteMacroInStr } from "@src/utils/macros";
import { applyWidgetPVData } from "./widgetRenderUtils";

/**
 * Renders a single widget's content by subscribing only to the PV(s) that
 * widget actually uses.  React.memo + the per-PV Zustand selector guarantee
 * that this component re-renders only when:
 *   1. Its own PV data changes, or
 *   2. Its base widget object changes (widget config / grid-macro change), or
 *   3. globalMacros change (forwarded navigation macros or rule-driven macro updates), or
 *   4. Its parent re-renders with new children (containers only).
 *
 * All other PV ticks in the system are invisible to this component.
 */
const LiveWidget = memo(function WidgetRenderItem({
  w,
  globalMacros,
  children,
}: {
  w: Widget;
  globalMacros: Record<string, string>;
  /** Rendered after the widget content */
  children?: ReactNode;
}) {
  // Collect every PV name this widget cares about:
  // - its primary PV, multi-PV list, and any PVs referenced in rule conditions.
  const pvNames = useMemo(() => {
    const names = new Set<string>();
    if (w.runtimePVName) names.add(w.runtimePVName);
    w.runtimePVNames?.forEach((pv) => names.add(pv));
    w.rules?.forEach((rule) => {
      rule.rulesets.forEach((ruleset) => {
        ruleset.pvNames.forEach((pv) => {
          const resolved = substituteMacroInStr(pv, globalMacros);
          if (resolved) names.add(resolved);
        });
        if (rule.targetProperty === "pvName" && typeof ruleset.value === "string") {
          const resolved = substituteMacroInStr(ruleset.value, globalMacros);
          if (resolved) names.add(resolved);
        }
      });
      if (rule.targetProperty === "pvNames" && Array.isArray(rule.rulesets)) {
        for (const ruleset of rule.rulesets) {
          if (!Array.isArray(ruleset.value)) continue;
          for (const pv of ruleset.value) {
            if (typeof pv !== "string") continue;
            const resolved = substituteMacroInStr(pv, globalMacros);
            if (resolved) names.add(resolved);
          }
        }
      }
    });
    return [...names];
  }, [w, globalMacros]);

  // Subscribe (from Zustand store) only to this widget's relevant PVs.
  // `useShallow` ensures re-render only when any selected value changes by reference.
  const relevantPvs = usePVStore(
    useShallow((state) => {
      if (!pvNames.length) return {};
      const result: Record<string, PVData> = {};
      for (const pv of pvNames) {
        const d = state.pvs[pv];
        if (d) result[pv] = d;
      }
      return result;
    }),
  );

  // Inject pvData + runtime macros + rule overrides.
  const mergedWidget = useMemo(
    () => applyWidgetPVData(w, relevantPvs, globalMacros),
    [w, relevantPvs, globalMacros],
  );

  if (mergedWidget.editableProperties.visible?.value === false) return null;
  const Comp = WidgetRegistry[w.widgetName]?.component;
  return (
    <>
      {Comp && <Comp data={mergedWidget} />}
      {children}
    </>
  );
});

export default LiveWidget;
