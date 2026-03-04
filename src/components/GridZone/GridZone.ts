// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { GRID_ID } from "@src/constants/constants";
import { PROPERTY_SCHEMAS } from "@src/types/widgetProperties";
import type { Widget } from "@src/types/widgets";
import { GridZoneComp } from "./GridZoneComp";

// not added to registry, but treated as a special type of widget for consistency
export const GridZone: Widget = {
  id: GRID_ID,
  component: GridZoneComp,
  widgetName: "GridZone",
  widgetLabel: "Editor",
  category: "Grid",
  editableProperties: {
    backgroundColor: PROPERTY_SCHEMAS.backgroundColor,
    gridLineColor: PROPERTY_SCHEMAS.gridLineColor,
    gridSize: PROPERTY_SCHEMAS.gridSize,
    gridLineVisible: PROPERTY_SCHEMAS.gridLineVisible,
    snapToGrid: PROPERTY_SCHEMAS.snapToGrid,
    centerVisible: PROPERTY_SCHEMAS.centerVisible,
    macros: PROPERTY_SCHEMAS.macros,
  },
} as const;
