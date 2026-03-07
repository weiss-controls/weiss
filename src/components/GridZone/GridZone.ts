// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { PROPERTY_SCHEMAS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import { GridZoneComp } from "./GridZoneComp";

// Not added to registry, but treated as a special widget definition for consistency.
// Use createWidgetInstance(GridZone, GRID_ID) to create the runtime instance.
export const GridZone: WidgetDefinition = {
  component: GridZoneComp,
  widgetName: "GridZone",
  widgetLabel: "Editor",
  category: "Grid",
  defaultProperties: {
    backgroundColor: PROPERTY_SCHEMAS.backgroundColor,
    gridLineColor: PROPERTY_SCHEMAS.gridLineColor,
    gridSize: PROPERTY_SCHEMAS.gridSize,
    gridLineVisible: PROPERTY_SCHEMAS.gridLineVisible,
    snapToGrid: PROPERTY_SCHEMAS.snapToGrid,
    centerVisible: PROPERTY_SCHEMAS.centerVisible,
    macros: PROPERTY_SCHEMAS.macros,
  },
};
