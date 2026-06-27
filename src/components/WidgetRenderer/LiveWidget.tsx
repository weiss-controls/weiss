// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { memo, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import WidgetRegistry from "@components/WidgetRegistry/WidgetRegistry";
import type { Widget } from "@src/types/widgets";
import type { PVData } from "@src/types/epicsWS";
import { usePVStore } from "@src/services/pvStore";
import { substituteInStr } from "@src/utils/macros";
import { applyWidgetPVData } from "./widgetRenderUtils";

const EMPTY_PVS: Record<string, PVData> = {};

/**
 * Renders a single widget's content by subscribing only to the PV(s) that
 * widget actually uses.  React.memo + the per-PV Zustand selector guarantee
 * that this component re-renders only when:
 *   1. Its own PV data changes, or
 *   2. Its base widget object changes (widget config / grid-macro change), or
 *   3. globalMacros change (macroOverrides update).
 *
 * All other PV ticks in the system are invisible to this component.
 */
const LiveWidget = memo(function WidgetRenderItem({
  w,
  globalMacros,
}: {
  w: Widget;
  globalMacros: Record<string, string>;
}) {
  // Collect every PV name this widget cares about:
  // - its primary PV, multi-PV list, and any PVs referenced in rule conditions.
  const pvNames = useMemo(() => {
    const names = new Set<string>();
    if (w.runtimePVName) names.add(w.runtimePVName);
    w.runtimePVNames?.forEach((pv) => names.add(pv));
    w.rules?.forEach((rule) => {
      rule.pvNames.forEach((pv) => {
        const resolved = substituteInStr(pv, globalMacros);
        if (resolved) names.add(resolved);
      });
      // Rule action may reference a separate write PV.
      if (typeof rule.actions?.pvName === "string" && rule.actions.pvName) {
        const resolved = substituteInStr(rule.actions.pvName, globalMacros);
        if (resolved) names.add(resolved);
      }
    });
    return [...names];
  }, [w, globalMacros]);

  // Subscribe only to this widget's relevant PVs.
  // `useShallow` ensures re-render only when any selected value changes by reference.
  const relevantPvs = usePVStore(
    useShallow((state) => {
      if (!pvNames.length) return EMPTY_PVS;
      const result: Record<string, PVData> = {};
      for (const pv of pvNames) {
        const d = state.pvs[pv];
        if (d) result[pv] = d;
      }
      return result;
    }),
  );

  // Inject pvData + pvvalue/pvname macros + rule overrides.
  const mergedWidget = useMemo(
    () => applyWidgetPVData(w, relevantPvs, globalMacros),
    [w, relevantPvs, globalMacros],
  );

  const Comp = WidgetRegistry[w.widgetName]?.component;
  if (!Comp) return null;
  return <Comp data={mergedWidget} />;
});

export default LiveWidget;
