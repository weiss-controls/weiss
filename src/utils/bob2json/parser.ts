// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

/**
 * Phoebus Display Builder XML → PhoebusDisplay parser.
 *
 * Parses a raw Phoebus .opi XML string into the PhoebusDisplay intermediate
 * representation consumed by the converter (converter.ts).
 *
 * Parsing stages:
 *   1. Raw XML string → DOM (DOMParser)
 *   2. <display> root → PhoebusDisplay (version, width, height)
 *   3. Each <widget> element → PhoebusWidget (recursive for children)
 *   4. Each child element of a widget → properties Map entry:
 *        - scalar elements  → string | number
 *        - <background_color> / <foreground_color> / <border_color>
 *            → PhoebusColor { red, green, blue, name }
 *        - <font>           → PhoebusFont { family, size, bold, italic }
 *        - <states>         → PhoebusState[]
 *        - <items>          → string[]
 *        - <actions>        → stored as raw Element for future handling
 */

import { PhoebusAttribute, PhoebusElement, PhoebusProperty, PhoebusWidgetType } from "./constants";
import type { PhoebusDisplay, PhoebusWidget } from "./types";

/* -------------------------------------------------------------------------- */
/* Parse error                                                                 */
/* -------------------------------------------------------------------------- */

export class PhoebusParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhoebusParseError";
  }
}

/* -------------------------------------------------------------------------- */
/* Structured property value types                                             */
/* -------------------------------------------------------------------------- */

export interface PhoebusColor {
  name?: string;
  red: number;
  green: number;
  blue: number;
}

export interface PhoebusFont {
  family?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
}

export interface PhoebusState {
  value: number;
  label: string;
  color?: PhoebusColor;
}

/* -------------------------------------------------------------------------- */
/* Scalar helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Returns the trimmed text content of the first matching child element, or undefined. */
function childText(parent: Element, tag: string): string | undefined {
  const el = parent.getElementsByTagName(tag)[0];
  return el?.textContent?.trim() ?? undefined;
}

/** Parses the text content of a child element as a finite number, or returns undefined. */
function childNumber(parent: Element, tag: string): number | undefined {
  const text = childText(parent, tag);
  if (text === undefined) return undefined;
  const n = Number(text);
  return isFinite(n) ? n : undefined;
}

/* -------------------------------------------------------------------------- */
/* Structured property parsers                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Parses a <color name red green blue /> element into a PhoebusColor.
 * The <color> tag appears both as a direct child (background_color wrapper
 * contains one <color>) and doubly-nested (state <color> wrapper contains
 * one <color>).
 */
function parseColorElement(colorEl: Element): PhoebusColor {
  return {
    name: colorEl.getAttribute(PhoebusAttribute.NAME) ?? undefined,
    red: Number(colorEl.getAttribute(PhoebusAttribute.RED) ?? 0),
    green: Number(colorEl.getAttribute(PhoebusAttribute.GREEN) ?? 0),
    blue: Number(colorEl.getAttribute(PhoebusAttribute.BLUE) ?? 0),
  };
}

/**
 * Parses a color wrapper element (e.g. <background_color>) by descending
 * into the inner <color> element it contains.
 * Returns undefined when the inner <color> element is absent.
 */
function parseColorWrapper(wrapperEl: Element): PhoebusColor | undefined {
  const inner = wrapperEl.getElementsByTagName(PhoebusElement.COLOR)[0];
  return inner ? parseColorElement(inner) : undefined;
}

/**
 * Parses a <font> element.
 *
 * Phoebus font element shape:
 *   <font family="Liberation Sans" size="14" style="BOLD_ITALIC" />
 *
 * The style attribute is one of: REGULAR | BOLD | ITALIC | BOLD_ITALIC
 */
function parseFontElement(fontEl: Element): PhoebusFont {
  const family = fontEl.getAttribute("family") ?? undefined;
  const sizeAttr = fontEl.getAttribute("size");
  const size = sizeAttr !== null ? Number(sizeAttr) : undefined;
  const style = fontEl.getAttribute("style") ?? "";

  return {
    family,
    size: size !== undefined && isFinite(size) ? size : undefined,
    bold: style.includes("BOLD"),
    italic: style.includes("ITALIC"),
  };
}

/**
 * Parses a <font> wrapper element (which contains one <font ... /> child)
 * into a PhoebusFont. Returns undefined when the inner element is absent.
 */
function parseFontWrapper(wrapperEl: Element): PhoebusFont | undefined {
  // Phoebus stores font as: <font><font family=".." size=".." style=".."/></font>
  const inner = wrapperEl.getElementsByTagName(PhoebusElement.FONT)[0];
  return inner ? parseFontElement(inner) : undefined;
}

/**
 * Parses a <states> element into a PhoebusState array.
 *
 * Shape:
 *   <states>
 *     <state>
 *       <value>0</value>
 *       <label>Off</label>
 *       <color><color name="Off" red=".." green=".." blue=".."/></color>
 *     </state>
 *   </states>
 */
function parseStates(statesEl: Element): PhoebusState[] {
  return Array.from(statesEl.getElementsByTagName(PhoebusElement.STATE)).map((stateEl) => {
    const value = childNumber(stateEl, PhoebusElement.VALUE) ?? 0;
    const label = childText(stateEl, PhoebusElement.LABEL) ?? "";

    // The color wrapper inside a state is also called <color>
    const colorWrapper = stateEl.getElementsByTagName(PhoebusElement.COLOR)[0];
    const color = colorWrapper ? parseColorWrapper(colorWrapper) : undefined;

    return { value, label, color };
  });
}

/**
 * Parses an <items> element into a plain string array.
 *
 * Shape:
 *   <items><item>Item 1</item><item>Item 2</item></items>
 */
function parseItems(itemsEl: Element): string[] {
  return Array.from(itemsEl.getElementsByTagName(PhoebusElement.ITEM)).map(
    (el) => el.textContent?.trim() ?? "",
  );
}

/* -------------------------------------------------------------------------- */
/* Widget parser                                                               */
/* -------------------------------------------------------------------------- */

const COLOR_WRAPPER_TAGS = new Set([
  PhoebusProperty.BACKGROUND_COLOR,
  PhoebusProperty.FOREGROUND_COLOR,
  PhoebusProperty.BORDER_COLOR,
]);

/**
 * Converts a single <widget> DOM element into a PhoebusWidget.
 * Children are parsed recursively.
 */
function parseWidget(widgetEl: Element): PhoebusWidget {
  const type = (widgetEl.getAttribute(PhoebusAttribute.TYPE) ?? "") as PhoebusWidgetType;
  const properties = new Map<PhoebusProperty, unknown>();
  const children: PhoebusWidget[] = [];

  for (const child of Array.from(widgetEl.children)) {
    const tag = child.tagName as PhoebusProperty;

    /* ── Nested widget children (group, tabs) ─────────────────────────── */
    if (tag === PhoebusElement.WIDGET) {
      children.push(parseWidget(child as Element));
      continue;
    }

    /* ── Tab children — each <tab> contains a <children> block ───────── */
    if (tag === PhoebusElement.TABS) {
      const tabWidgets: PhoebusWidget[] = [];
      for (const tabEl of Array.from(child.getElementsByTagName(PhoebusElement.TAB))) {
        const childrenEl = tabEl.getElementsByTagName(PhoebusElement.CHILDREN)[0];
        if (!childrenEl) continue;
        for (const nestedWidget of Array.from(
          childrenEl.getElementsByTagName(PhoebusElement.WIDGET),
        )) {
          tabWidgets.push(parseWidget(nestedWidget as Element));
        }
      }
      properties.set(PhoebusProperty.TABS, tabWidgets);
      continue;
    }

    /* ── Color wrappers ───────────────────────────────────────────────── */
    if (COLOR_WRAPPER_TAGS.has(tag)) {
      const color = parseColorWrapper(child);
      if (color) properties.set(tag, color);
      continue;
    }

    /* ── Font ─────────────────────────────────────────────────────────── */
    if (tag === PhoebusProperty.FONT) {
      const font = parseFontWrapper(child);
      if (font) properties.set(PhoebusProperty.FONT, font);
      continue;
    }

    /* ── States (multi_state_led) ─────────────────────────────────────── */
    if (tag === PhoebusElement.STATES) {
      properties.set(PhoebusProperty.STATES, parseStates(child));
      continue;
    }

    /* ── Items (choice, radio) ────────────────────────────────────────── */
    if (tag === PhoebusElement.ITEMS) {
      properties.set(PhoebusProperty.ITEMS, parseItems(child));
      continue;
    }

    /* ── Actions / scripts / rules — store raw for future handling ────── */
    if (
      tag === PhoebusProperty.ACTIONS ||
      tag === PhoebusProperty.SCRIPTS ||
      tag === PhoebusProperty.RULES
    ) {
      properties.set(tag, child);
      continue;
    }

    /* ── Scalar fallback: read text content as string or number ───────── */
    const text = child.textContent?.trim() ?? "";
    const asNumber = Number(text);
    properties.set(tag, isFinite(asNumber) && text !== "" ? asNumber : text);
  }

  return {
    type,
    name: properties.get(PhoebusProperty.NAME) as string | undefined,
    properties,
    children,
  };
}

/* -------------------------------------------------------------------------- */
/* Display parser                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Parses a raw Phoebus .opi XML string into a PhoebusDisplay.
 *
 * Throws PhoebusParseError when:
 *   - the XML is malformed (DOMParser reports a parseerror)
 *   - the root element is not <display>
 *
 * Usage:
 *   const display = parsePhoebus(xmlString);
 *   const { widgets, warnings } = convertDisplay(display);
 */
export function parsePhoebus(xml: string): PhoebusDisplay {
  const doc = new DOMParser().parseFromString(xml, "text/xml");

  // DOMParser signals errors via a <parseerror> element rather than throwing
  const parseError = doc.querySelector("parseerror");
  if (parseError) {
    throw new PhoebusParseError(
      `XML parse error: ${parseError.textContent?.trim() ?? "unknown error"}`,
    );
  }

  const root = doc.documentElement;
  if (root.tagName !== PhoebusElement.DISPLAY) {
    throw new PhoebusParseError(`Expected root element <display>, got <${root.tagName}>`);
  }

  const version = root.getAttribute(PhoebusAttribute.VERSION) ?? undefined;
  const width = childNumber(root, PhoebusProperty.WIDTH);
  const height = childNumber(root, PhoebusProperty.HEIGHT);

  const widgets: PhoebusWidget[] = Array.from(
    // Only direct <widget> children of <display> — not descendants
    root.children,
  )
    .filter((el) => el.tagName === PhoebusElement.WIDGET)
    .map((el) => parseWidget(el as Element));

  return { version, width, height, widgets };
}
