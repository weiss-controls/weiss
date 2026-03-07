// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import * as Widgets from "@components/Widgets";
import type { WidgetDefinition } from "@src/types/widgets";

/**
 * WidgetRegistry is a centralized mapping of widget names to their corresponding widget definitions.
 * This registry is used by the editor to dynamically instantiate and render widgets.
 */
const WidgetRegistry = Widgets as Record<string, WidgetDefinition>;
export default WidgetRegistry;
