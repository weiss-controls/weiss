// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

/**
 * Parses Phoebus Display Builder XML into a PhoebusDisplay IR.
 */

import { PhoebusAttribute, PhoebusElement, PhoebusProperty, PhoebusWidgetType } from "./constants";
import type {
  ColorWrapperProperty,
  PhoebusColor,
  PhoebusDisplay,
  PhoebusFont,
  PhoebusNavTab,
  PhoebusState,
  PhoebusWidget,
} from "./types";

// Public exports

export type { PhoebusColor, PhoebusFont, PhoebusState } from "./types";

// Parse error

export class PhoebusParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhoebusParseError";
  }
}

// Scalar helpers

/** Returns the trimmed text content of the first matching child element, or undefined. */
function childText(parent: Element, tag: string): string | undefined {
  const el = parent.getElementsByTagName(tag)[0];
  return el?.textContent?.trim() ?? undefined;
}

/** Returns the first direct child element with the given tag name, or undefined. */
function directChild(parent: Element, tag: string): Element | undefined {
  return Array.from(parent.children).find((el) => el.tagName === tag);
}

/** Parses the text content of a child element as a finite number, or returns undefined. */
function childNumber(parent: Element, tag: string): number | undefined {
  const text = childText(parent, tag);
  if (text === undefined) return undefined;
  const n = Number(text);
  return isFinite(n) ? n : undefined;
}

/** Parses a text string as a number when possible, otherwise returns it as-is. */
function parseScalar(text: string): string | number {
  const n = Number(text);
  return isFinite(n) && text !== "" ? n : text;
}

// Structured property parsers

/**
 * Parses a <color name red green blue /> element into a PhoebusColor.
 * The <color> tag appears both as a direct child (background_color wrapper
 * contains one <color>) and doubly-nested (state <color> wrapper contains
 * one <color>).
 */
function parseColorElement(colorEl: Element): PhoebusColor {
  const alphaAttr = colorEl.getAttribute(PhoebusAttribute.ALPHA);
  const alpha = alphaAttr !== null ? Number(alphaAttr) : undefined;

  return {
    name: colorEl.getAttribute(PhoebusAttribute.NAME) ?? undefined,
    red: Number(colorEl.getAttribute(PhoebusAttribute.RED) ?? 0),
    green: Number(colorEl.getAttribute(PhoebusAttribute.GREEN) ?? 0),
    blue: Number(colorEl.getAttribute(PhoebusAttribute.BLUE) ?? 0),
    alpha: alpha !== undefined && isFinite(alpha) ? alpha : undefined,
  };
}

/**
 * Parses a color wrapper element (e.g. <background_color>) by descending
 * into the inner <color> element it contains.
 * Returns undefined when the inner <color> element is absent.
 */
function parseColorWrapper(wrapperEl: Element): PhoebusColor | undefined {
  const inner = directChild(wrapperEl, PhoebusElement.COLOR);
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
  const family = fontEl.getAttribute(PhoebusAttribute.FAMILY) ?? undefined;
  const sizeAttr = fontEl.getAttribute(PhoebusAttribute.SIZE);
  const size = sizeAttr !== null ? Number(sizeAttr) : undefined;
  const style = fontEl.getAttribute(PhoebusAttribute.STYLE) ?? "";

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
  const inner = directChild(wrapperEl, PhoebusProperty.FONT);
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

/**
 * Parses a navtabs <tabs> element into PhoebusNavTab entries.
 *
 * Shape:
 *   <tabs>
 *     <tab>
 *       <name>Tab 1</name>
 *       <file>bla</file>
 *       <macros><key>value</key></macros>
 *     </tab>
 *   </tabs>
 */
function parseNavTabs(tabsEl: Element): PhoebusNavTab[] {
  return Array.from(tabsEl.getElementsByTagName(PhoebusElement.TAB)).map((tabEl) => {
    const name = childText(tabEl, PhoebusElement.NAME) ?? "";
    const file = childText(tabEl, PhoebusProperty.FILE);
    const macrosEl = directChild(tabEl, PhoebusProperty.MACROS);
    const macros = macrosEl ? parseMacros(macrosEl) : undefined;
    return { name, file, macros };
  });
}

/**
 * Parses a <macros> block into a string record.
 * Each direct child tag name becomes a macro key; text content is the value.
 */
function parseMacros(macrosEl: Element): Record<string, string> {
  const out: Record<string, string> = {};
  for (const child of Array.from(macrosEl.children)) {
    out[`$(${child.tagName})`] = child.textContent?.trim() ?? "";
  }
  return out;
}

// Widget parser

const COLOR_WRAPPER_TAGS: ReadonlySet<ColorWrapperProperty> = new Set([
  PhoebusProperty.BACKGROUND_COLOR,
  PhoebusProperty.FOREGROUND_COLOR,
  PhoebusProperty.BORDER_COLOR,
  PhoebusProperty.ON_COLOR,
  PhoebusProperty.OFF_COLOR,
  PhoebusProperty.LINE_COLOR,
  PhoebusProperty.SELECTED_COLOR,
]);

const PHOEBUS_PROPERTY_VALUES = new Set<string>(Object.values(PhoebusProperty));

function isPhoebusPropertyTag(tag: string): tag is PhoebusProperty {
  return PHOEBUS_PROPERTY_VALUES.has(tag);
}

function isColorWrapperTag(tag: string): tag is ColorWrapperProperty {
  return COLOR_WRAPPER_TAGS.has(tag as ColorWrapperProperty);
}

/**
 * Converts a single <widget> DOM element into a PhoebusWidget.
 * Children are parsed recursively.
 */
function parseWidget(widgetEl: Element): PhoebusWidget {
  const type = (widgetEl.getAttribute(PhoebusAttribute.TYPE) ?? "") as PhoebusWidgetType;
  const properties = new Map<PhoebusProperty, unknown>();
  const children: PhoebusWidget[] = [];

  for (const child of Array.from(widgetEl.children)) {
    const tag = child.tagName;

    // Nested widget children (group, tabs)
    if (tag === PhoebusElement.WIDGET) {
      children.push(parseWidget(child));
      continue;
    }

    // Tab children. Navtabs' <tab> entries carry name/file/macros; group-tabs'
    // <tab> entries instead contain a <children> block of nested widgets.
    if (tag === PhoebusElement.TABS) {
      if (type === PhoebusWidgetType.NAVIGATION_TABS) {
        properties.set(PhoebusProperty.TABS, parseNavTabs(child));
        continue;
      }

      const tabWidgets: PhoebusWidget[] = [];
      for (const tabEl of Array.from(child.getElementsByTagName(PhoebusElement.TAB))) {
        const childrenEl = tabEl.getElementsByTagName(PhoebusElement.CHILDREN)[0];
        if (!childrenEl) continue;
        for (const nestedWidget of Array.from(
          childrenEl.getElementsByTagName(PhoebusElement.WIDGET),
        )) {
          tabWidgets.push(parseWidget(nestedWidget));
        }
      }
      properties.set(PhoebusProperty.TABS, tabWidgets);
      continue;
    }

    // Color wrappers
    if (isColorWrapperTag(tag)) {
      const color = parseColorWrapper(child);
      if (color) properties.set(tag, color);
      continue;
    }

    // Font
    if (tag === PhoebusProperty.FONT) {
      const font = parseFontWrapper(child);
      if (font) properties.set(PhoebusProperty.FONT, font);
      continue;
    }

    // States (multi_state_led)
    if (tag === PhoebusElement.STATES) {
      properties.set(PhoebusProperty.STATES, parseStates(child));
      continue;
    }

    // Items (choice, radio)
    if (tag === PhoebusElement.ITEMS) {
      properties.set(PhoebusProperty.ITEMS, parseItems(child));
      continue;
    }

    // Macros (embedded display)
    if (tag === PhoebusProperty.MACROS) {
      properties.set(PhoebusProperty.MACROS, parseMacros(child));
      continue;
    }

    // Actions / scripts / rules. Store raw for future handling.
    if (
      tag === PhoebusProperty.ACTIONS ||
      tag === PhoebusProperty.SCRIPTS ||
      tag === PhoebusProperty.RULES
    ) {
      properties.set(tag, child);
      continue;
    }

    // Scalar fallback: read text content as string or number.
    if (!isPhoebusPropertyTag(tag)) continue;

    const text = child.textContent?.trim() ?? "";
    properties.set(tag, parseScalar(text));
  }

  return {
    type,
    name: properties.get(PhoebusProperty.NAME) as string | undefined,
    properties,
    children,
  };
}

// Display parser

/**
 * Parses a raw Phoebus .opi XML string into a PhoebusDisplay.
 *
 * Throws PhoebusParseError on malformed XML or invalid root element.
 */
export function parsePhoebus(xml: string): PhoebusDisplay {
  const doc = new DOMParser().parseFromString(xml, "text/xml");

  // DOMParser signals errors via a <parseerror> element instead of throwing.
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
  const x = childNumber(root, PhoebusProperty.X);
  const y = childNumber(root, PhoebusProperty.Y);
  const width = childNumber(root, PhoebusProperty.WIDTH);
  const height = childNumber(root, PhoebusProperty.HEIGHT);
  const macrosEl = directChild(root, PhoebusProperty.MACROS);
  const macros = macrosEl ? parseMacros(macrosEl) : undefined;
  const backgroundColorEl = directChild(root, PhoebusProperty.BACKGROUND_COLOR);
  const backgroundColor = backgroundColorEl ? parseColorWrapper(backgroundColorEl) : undefined;
  const gridColorEl = directChild(root, PhoebusProperty.GRID_COLOR);
  const gridColor = gridColorEl ? parseColorWrapper(gridColorEl) : undefined;
  const gridVisibleText = childText(root, PhoebusProperty.GRID_VISIBLE);
  const gridVisible = gridVisibleText === undefined ? undefined : parseScalar(gridVisibleText);
  const gridStepX = childNumber(root, PhoebusProperty.GRID_STEP_X);
  const gridStepY = childNumber(root, PhoebusProperty.GRID_STEP_Y);

  const widgets: PhoebusWidget[] = Array.from(
    // Only direct <widget> children of <display>, not descendants.
    root.children,
  )
    .filter((el) => el.tagName === PhoebusElement.WIDGET)
    .map((el) => parseWidget(el));

  return {
    version,
    x,
    y,
    width,
    height,
    macros,
    backgroundColor,
    gridColor,
    gridVisible,
    gridStepX,
    gridStepY,
    widgets,
  };
}
