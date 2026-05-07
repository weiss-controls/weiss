// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { PropertyKey, WidgetProperties, WidgetProperty } from "@src/types/widgets";

/**
 * Substitute $(MACRO_NAME) patterns in a single string using a macros map.
 * Unresolved macros (no matching key) are left as-is.
 */
export function substituteInStr(str: string, macros: Record<string, string>): string {
  return str.replace(/\$\(([^)]+)\)/g, (match) => macros[match] ?? match);
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
      const original = prop.value as string[];
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
