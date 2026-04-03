// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React from "react";
import * as Widgets from "@components/Widgets";
import type { WidgetDefinition } from "@src/types/widgets";

/**
 * WidgetRegistry is a centralized mapping of widget names to their corresponding widget definitions.
 * This registry is used by the editor to dynamically instantiate and render widgets.
 */
const WidgetRegistry: Record<string, WidgetDefinition> = Object.fromEntries(
  Object.entries(Widgets as Record<string, WidgetDefinition>).map(([name, def]) => [
    name,
    { ...def, component: React.memo(def.component) },
  ]),
);
export default WidgetRegistry;
