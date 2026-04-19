// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { CSSProperties } from "react";

/**
 * Color palette used across the application.
 * Values are read dynamically from CSS variables.
 * Main palettes:
 *  - https://coolors.co/palette/0d1b2a-1b263b-415a77-778da9-e0e1dd  
    - https://coolors.co/palette/0466c8-0353a4-023e7d-002855-001845-001233-33415c-5c677d-7d8597-979dac  
    - https://coolors.co/palette/f8f9fa-e9ecef-dee2e6-ced4da-adb5bd-6c757d-495057-343a40-212529  
 */
export const COLORS = {
  // Text / primary UI
  textColor: "#000000",
  titleBarColor: "#415a77",
  labelColor: "transparent",

  // Backgrounds / surfaces
  backgroundColor: "#e9ecef",
  inputColor: "#ffffff",
  readColor: "#ced4da",
  gridLineColor: "#dee2e6",
  buttonColor: "#979dac",
  lightGray: "#adb5bd",
  midGray: "#6c757d",

  // Blues
  graphLineColor: "#0353a4",
  midDarkBlue: "#023e7d",
  highlighted: "#0466c8",

  // Status / boolean
  onColor: "#00ac25",
  offColor: "#ac0000",

  // EPICS alarm colors
  minor: "#ffff00",
  major: "#ff0000",
  invalid: "#5b00c4",
  disconnected: "#5b00c4",

  // Git file status
  gitAdded: "#057c0b",
  gitModified: "#b48c06ff",
  gitDeleted: "#ac0000",

  // Utility
  transparent: "transparent",
};

/** z-index value for back layer of the UI (read from CSS variable) */
export const BACK_UI_ZIDX = parseInt(
  getComputedStyle(document.documentElement, null).getPropertyValue("--back-ui-zidx"),
);

/** z-index value for front layer of the UI (read from CSS variable) */
export const FRONT_UI_ZIDX = parseInt(
  getComputedStyle(document.documentElement, null).getPropertyValue("--front-ui-zidx"),
);

/** URL of the project source repository */
export const APP_SRC_URL = "https://github.com/weiss-controls/weiss";

/** Running application version */
export const APP_VERSION = __APP_VERSION__;

/** WebSocket server URL for PV communication */
export const WS_URL = (() => {
  const isHttps = window.location.protocol === "https:";
  const protocol = isHttps ? "wss:" : "ws:";
  const hostname = window.location.hostname;

  if (isHttps) {
    // use NGINX proxy with /ws suffix
    return `${protocol}//${hostname}/ws/`;
  } else {
    // connect directly to backend port, no proxy needed
    return `${protocol}//${hostname}:8080`;
  }
})();

/** Editor mode string (design time) */
export const EDIT_MODE = "edit";

/** Runtime mode string (connected to PVs) */
export const RUNTIME_MODE = "runtime";

/** Union type for valid app modes */
export type Mode = typeof EDIT_MODE | typeof RUNTIME_MODE;

/** Width of the widget selector panel in pixels */
export const WIDGET_SELECTOR_WIDTH = 230;

/** Reserved ID for the grid widget */
export const GRID_ID = "__grid__";

/** Maximum number of actions stored in undo/redo history */
export const MAX_HISTORY = 100;

/** Maximum allowed zoom level */
export const MAX_ZOOM = 100;

/** Minimum allowed zoom level */
export const MIN_ZOOM = 0.2;

const gridDecimalPlaces = 3;

/** Rounding constant derived from gridDecimalPlaces, used to round coordinates to the grid */
export const ROUNDING_CONST = 10 ** gridDecimalPlaces;
/**
 * Mapping of widget alignment keywords to CSS `justifyContent` values.
 */
export const FLEX_ALIGN_MAP: Record<string, CSSProperties["justifyContent"]> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
  top: "flex-start",
  middle: "center",
  bottom: "flex-end",
};
