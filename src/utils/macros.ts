// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { PVData } from "@src/types/epicsWS";
import type { PropertyKey, WidgetProperties, WidgetProperty } from "@src/types/widgets";

/**
 * Substitute $(MACRO_NAME) patterns in a single string using a macros map.
 * Unresolved macros (no matching key) are left as-is.
 */
export function substituteInStr(str: string, macros: Record<string, string>): string {
  return str.replace(/\$\(([^)]+)\)/g, (match) => macros[match] ?? match);
}

/**
 * Build the built-in per-widget macro map from resolved PV data.
 * Keys follow the same $(NAME) convention as user macros so they flow
 * through substituteInStr / substituteTextProps unchanged.
 *
 * @param substitutedPVName The widget's PV name after user macros are applied.
 * @param pvData            Resolved PV data for this widget (may be undefined).
 */
export function buildInternalMacros(
  substitutedPVName: string | undefined,
  pvData: PVData | undefined,
): Record<string, string> {
  const macros: Record<string, string> = {};
  if (substitutedPVName) macros["$(pvname)"] = substitutedPVName;
  if (pvData?.display?.description) macros["$(pvdesc)"] = pvData.display.description;
  if (pvData?.display?.units) macros["$(pvunits)"] = pvData.display.units;
  if (pvData?.value !== undefined)
    macros["$(pvvalue)"] = Array.isArray(pvData.value)
      ? pvData.value.join(", ")
      : String(pvData.value);
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
  for (const key of Object.keys(props) as PropertyKey[]) {
    const prop = props[key];
    if (!prop) {
      continue;
    }
    if (prop.selType === "text" && typeof prop.value === "string") {
      const substituted = substituteInStr(prop.value, macros);
      resultRecord[key] = substituted !== prop.value ? { ...prop, value: substituted } : prop;
    } else if (prop.selType === "strList" && Array.isArray(prop.value)) {
      const original = prop.value;
      const substituted = original.map((s) => substituteInStr(s, macros));
      resultRecord[key] = substituted.some((s, i) => s !== original[i])
        ? { ...prop, value: substituted }
        : prop;
    } else {
      resultRecord[key] = prop;
    }
  }
  return result;
}
