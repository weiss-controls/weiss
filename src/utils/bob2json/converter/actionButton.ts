// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { PhoebusAttribute, PhoebusProperty } from "../constants";
import type { PhoebusWidget } from "../types";
import { isPhoebusInternalPvNameMacro, mapEmbeddedDisplayPath } from "./valueMappers";

/**
 * Parses Phoebus action_button payloads.
 */

type ActionButtonMode = "write_pv" | "open_display";

export interface ParsedActionButton {
  mode?: ActionButtonMode;
  pvName?: string;
  actionValue?: string | number;
  displayPath?: string;
  macros?: Record<string, string>;
  target?: string;
}

function directChildText(parent: Element, tagName: string): string | undefined {
  const child = Array.from(parent.children).find((el) => el.tagName === tagName);
  return child?.textContent?.trim() ?? undefined;
}

function parseActionMacros(actionEl: Element): Record<string, string> | undefined {
  const macrosEl = Array.from(actionEl.children).find(
    (el) => el.tagName === PhoebusProperty.MACROS,
  );
  if (!macrosEl) return undefined;

  const macros: Record<string, string> = {};
  for (const macroEl of Array.from(macrosEl.children)) {
    const key = macroEl.tagName.trim();
    const value = macroEl.textContent?.trim();
    if (key && value !== undefined) macros[key] = value;
  }

  return Object.keys(macros).length > 0 ? macros : undefined;
}

export function parseActionButton(phWidget: PhoebusWidget, warnings: string[]): ParsedActionButton {
  const rawActions = phWidget.properties.get(PhoebusProperty.ACTIONS);
  if (!(rawActions instanceof Element)) {
    warnings.push(
      `Widget "${phWidget.name ?? phWidget.type}": could not read action payload - defaulting to ActionButton.`,
    );
    return {};
  }

  const actionEl = Array.from(rawActions.children).find((el) => el.tagName === "action");
  if (!actionEl) {
    warnings.push(
      `Widget "${phWidget.name ?? phWidget.type}": no action element found - defaulting to ActionButton.`,
    );
    return {};
  }

  const mode = actionEl.getAttribute(PhoebusAttribute.TYPE)?.trim().toLowerCase();
  if (mode === "write_pv") {
    const rawPvName = directChildText(actionEl, PhoebusProperty.PV_NAME);
    const rootPvName = phWidget.properties.get(PhoebusProperty.PV_NAME);
    const resolvedPvName = isPhoebusInternalPvNameMacro(rawPvName)
      ? typeof rootPvName === "string"
        ? rootPvName.trim()
        : undefined
      : (rawPvName ?? (typeof rootPvName === "string" ? rootPvName.trim() : undefined));

    const rawValue = directChildText(actionEl, "value");
    const parsedValue = rawValue === undefined ? undefined : Number(rawValue);

    return {
      mode: "write_pv",
      pvName: resolvedPvName,
      actionValue:
        rawValue === undefined || rawValue === ""
          ? undefined
          : parsedValue !== undefined && isFinite(parsedValue)
            ? parsedValue
            : rawValue,
    };
  }

  if (mode === "open_display") {
    const rawFile = directChildText(actionEl, PhoebusProperty.FILE);
    const rawTarget = directChildText(actionEl, "target");

    return {
      mode: "open_display",
      displayPath: rawFile ? (mapEmbeddedDisplayPath(rawFile) ?? rawFile) : undefined,
      macros: parseActionMacros(actionEl),
      target: rawTarget,
    };
  }

  warnings.push(
    `Widget "${phWidget.name ?? phWidget.type}": unsupported action type "${mode ?? "unknown"}" - defaulting to ActionButton.`,
  );
  return {};
}
