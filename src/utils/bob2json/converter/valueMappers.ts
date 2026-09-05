// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { PhoebusAlignment, PhoebusAttribute, PhoebusBoolean, PhoebusProperty } from "../constants";
import type {
  PhoebusFont,
  PhoebusNavTab,
  PhoebusState,
  PhoebusTrace,
  PhoebusWidget,
} from "../types";
import type { PropertyValue, StateEntry, TabEntry } from "@src/types/widgets";
import { COLORS } from "@src/constants/constants";

/**
 * Shared value transformation utilities for Phoebus -> WEISS conversion.
 */

export function colorToRgba(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  const r = Number(c[PhoebusAttribute.RED]);
  const g = Number(c[PhoebusAttribute.GREEN]);
  const b = Number(c[PhoebusAttribute.BLUE]);
  if ([r, g, b].some(isNaN)) return undefined;

  const rawAlpha = c[PhoebusAttribute.ALPHA];
  const alphaNumber = rawAlpha === undefined ? 1 : Number(rawAlpha);
  if (isNaN(alphaNumber)) return undefined;

  const normalizedAlpha = alphaNumber > 1 ? alphaNumber / 255 : alphaNumber;
  const clampedAlpha = Math.max(0, Math.min(1, normalizedAlpha));
  const clampedR = Math.max(0, Math.min(255, r));
  const clampedG = Math.max(0, Math.min(255, g));
  const clampedB = Math.max(0, Math.min(255, b));

  return `rgba(${clampedR}, ${clampedG}, ${clampedB}, ${clampedAlpha})`;
}

export function mapHAlign(raw: unknown): string | undefined {
  if (typeof raw === "number") {
    switch (raw) {
      case 0:
        return "left";
      case 1:
        return "center";
      case 2:
        return "right";
      default:
        return undefined;
    }
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    const asNumber = Number(trimmed);
    if (!isNaN(asNumber)) return mapHAlign(asNumber);

    const normalized = trimmed.toUpperCase();
    if (normalized === "LEFT") return "left";
    if (normalized === "CENTER" || normalized === "CENTRE") return "center";
    if (normalized === "RIGHT") return "right";
  }

  switch (raw) {
    case PhoebusAlignment.LEFT:
      return "left";
    case PhoebusAlignment.CENTER:
      return "center";
    case PhoebusAlignment.RIGHT:
      return "right";
    default:
      return "left";
  }
}

export function mapVAlign(raw: unknown): string | undefined {
  if (typeof raw === "number") {
    switch (raw) {
      case 0:
        return "top";
      case 1:
        return "middle";
      case 2:
        return "bottom";
      default:
        return "middle";
    }
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    const asNumber = Number(trimmed);
    if (!isNaN(asNumber)) return mapVAlign(asNumber);

    const normalized = trimmed.toUpperCase();
    if (normalized === "TOP") return "top";
    if (normalized === "MIDDLE" || normalized === "CENTER" || normalized === "CENTRE") {
      return "middle";
    }
    if (normalized === "BOTTOM") return "bottom";
  }

  switch (raw) {
    case PhoebusAlignment.TOP:
      return "top";
    case PhoebusAlignment.MIDDLE:
      return "middle";
    case PhoebusAlignment.CENTER:
      return "middle";
    case PhoebusAlignment.BOTTOM:
      return "bottom";
    default:
      return "middle";
  }
}

export function mapLineStyle(raw: unknown): string | undefined {
  if (typeof raw === "string") {
    const normalized = raw.trim().toUpperCase();
    switch (normalized) {
      case "SOLID":
        return "solid";
      case "DASH":
        return "dashed";
      case "DOT":
        return "dotted";
      case "DASHDOT":
      case "DASHDOTDOT":
        return "dashed";
      default:
        return "none";
    }
  }
  if (typeof raw === "number") {
    switch (raw) {
      case 0:
        return "solid";
      case 1:
        return "dashed";
      case 2:
        return "dotted";
      case 3:
      case 4:
        return "dashed";
      default:
        return "none";
    }
  }
  return "none";
}

export function extractFontProps(raw: unknown): Record<string, PropertyValue> {
  if (!raw || typeof raw !== "object") return {};
  const f = raw as PhoebusFont;
  const out: Record<string, PropertyValue> = {};

  if (f.family) {
    const familyStr = String(f.family).trim().toLowerCase();
    if (familyStr.includes("monospace")) out.fontFamily = "monospace";
    else if (familyStr.includes("sans")) out.fontFamily = "sans-serif";
    else if (familyStr.includes("serif")) out.fontFamily = "serif";
    else if (familyStr.includes("fantasy")) out.fontFamily = "fantasy";
    else if (familyStr.includes("cursive")) out.fontFamily = "cursive";
    else out.fontFamily = "serif";
  }

  if (f.size !== undefined) out.fontSize = f.size;
  if (f.bold !== undefined) out.fontBold = f.bold;
  if (f.italic !== undefined) out.fontItalic = f.italic;

  return out;
}

export function isTrue(raw: unknown): boolean {
  return raw === true || raw === PhoebusBoolean.TRUE || raw === 1;
}

export function mapStates(raw: unknown): StateEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const states = raw as PhoebusState[];
  const mapped = states
    .map((state): StateEntry | null => {
      const color = colorToRgba(state.color);
      if (color === undefined) return null;

      return {
        value: String(state.value),
        color,
        label: state.label ?? "",
      };
    })
    .filter((state): state is StateEntry => state !== null);

  return mapped.length > 0 ? mapped : undefined;
}

export function mapEmbeddedDisplayPath(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  return raw.replace(/\.bob$/i, ".opi.json");
}

/** Converts parsed plot traces into WEISS PV and line-color arrays. */
export function mapTraces(
  raw: unknown,
  xyPlot = false,
): { pvNames: string[]; lineColors: string[] } | undefined {
  if (!Array.isArray(raw)) return undefined;

  const traces = raw as PhoebusTrace[];
  const pvNames: string[] = [];
  const lineColors: string[] = [];
  let xPv: string | undefined;

  for (const trace of traces) {
    if (xyPlot && !xPv && trace.xPv) xPv = trace.xPv;
  }

  if (xPv) pvNames.push(xPv);

  for (const trace of traces) {
    if (!trace.yPv) continue;
    pvNames.push(trace.yPv);
    lineColors.push(colorToRgba(trace.color) ?? COLORS.graphLineColor);
  }

  return pvNames.length > 0 ? { pvNames, lineColors } : undefined;
}

/** Converts navtabs' parsed <tab> entries into WEISS TabEntry objects. */
export function mapNavTabs(raw: unknown): TabEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const tabs = raw as PhoebusNavTab[];
  const mapped: TabEntry[] = tabs.map((tab) => ({
    label: tab.name,
    displayPath: mapEmbeddedDisplayPath(tab.file) ?? "",
    macros: tab.macros ?? {},
  }));

  return mapped.length > 0 ? mapped : undefined;
}

export function getNumericProperty(
  phWidget: PhoebusWidget,
  key: PhoebusProperty,
  fallback: number,
): number {
  const raw = phWidget.properties.get(key);
  if (typeof raw === "number" && isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (isFinite(parsed)) return parsed;
  }
  return fallback;
}

const PHOEBUS_TO_WEISS_TOOLTIP_MACROS: Record<string, string> = {
  pv_name: "$(pvname)",
  pv_value: "$(pvvalue)",
  pv_desc: "$(pvdesc)",
  pv_unit: "$(pvunits)",
};

const WEISS_RUNTIME_TOOLTIP_MACROS = new Set(["pvname", "pvvalue", "pvdesc", "pvunits"]);
const PHOEBUS_UNSUPPORTED_TOOLTIP_MACROS = new Set(["actions"]);

function extractMacroIdentifier(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const match = /^\$\(([^)]+)\)$/.exec(raw.trim());
  if (!match) return undefined;
  return match[1]?.trim().toLowerCase();
}

export function isPhoebusInternalPvNameMacro(raw: unknown): boolean {
  const macroId = extractMacroIdentifier(raw);
  return macroId === "pv_name" || macroId === "pvname";
}

/**
 * Converts Phoebus internal tooltip macros to WEISS runtime macros.
 * Unknown internal macros are removed.
 */
export function normalizeTooltipMacros(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  if (!raw.includes("$(")) return raw;

  const mapped = raw.replace(/\$\(([^)]+)\)/g, (_full, macroNameRaw: string) => {
    const macroName = macroNameRaw.trim().toLowerCase();
    const mappedKnownMacro = PHOEBUS_TO_WEISS_TOOLTIP_MACROS[macroName];
    if (mappedKnownMacro) return mappedKnownMacro;

    if (WEISS_RUNTIME_TOOLTIP_MACROS.has(macroName)) return `$(${macroName})`;
    if (PHOEBUS_UNSUPPORTED_TOOLTIP_MACROS.has(macroName)) return "";
    if (macroName.startsWith("pv_")) return "";

    // Keep user-defined macros unchanged.
    return `$(${macroNameRaw.trim()})`;
  });

  return mapped
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}
