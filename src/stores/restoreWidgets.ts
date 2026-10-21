// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { v4 as uuidv4 } from "uuid";
import { GridZone } from "@components/GridZone";
import WidgetRegistry from "@components/WidgetRegistry/WidgetRegistry";
import { GRID_ID } from "@src/constants/constants";
import type { ExportedWidget, PropertyKey, Widget } from "@src/types/widgets";
import { parseSerializedRules } from "@src/utils/ruleCompatibility";
import { createGroupWidget, createWidgetInstance } from "./widgetHelpers";

/**
 * Builds widget instances from exported file content. Unknown widgets are skipped and unknown
 * properties ignored, each adding a message to `warnings`.
 */
export function restoreWidgets(exported: ExportedWidget[], warnings: string[]): Widget[] {
  const restoreWidget = (raw: ExportedWidget, idx?: number): Widget | null => {
    let instance: Widget;
    if (idx === 0 && raw.widgetName === "GridZone") {
      instance = createWidgetInstance(GridZone, GRID_ID);
    } else if (raw.widgetName === "Group") {
      instance = createGroupWidget(uuidv4());
    } else {
      const baseWdg = WidgetRegistry[raw.widgetName];
      if (!baseWdg) {
        warnings.push(`Unknown widget type "${raw.widgetName}" — skipped`);
        return null;
      }
      instance = createWidgetInstance(baseWdg, `${raw.widgetName}-${uuidv4()}`);
    }

    if (raw.children && raw.children.length > 0) {
      instance.children = raw.children
        .map((child) => restoreWidget(child))
        .filter((c): c is Widget => c !== null);
    }

    for (const [key, val] of Object.entries(raw.properties ?? {})) {
      const propName = key as PropertyKey;
      if (instance.editableProperties[propName]) {
        instance.editableProperties[propName].value = val;
      } else {
        warnings.push(`Unknown property "${key}" on widget "${raw.widgetName}" — ignored`);
      }
    }

    // Rebuild runtime-only rule fields stripped from the export
    if (raw.rules?.length) instance.rules = parseSerializedRules(raw.rules);
    return instance;
  };

  return exported.map((raw, idx) => restoreWidget(raw, idx)).filter((w): w is Widget => w !== null);
}
