// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { PROPERTY_SCHEMAS, COMMON_PROPS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import { ImageComp } from "./ImageComp";
import ImageIcon from "@mui/icons-material/Image";

const { alarmBorder, ...FILTERED_COMMON_PROPS } = COMMON_PROPS;

export const Image: WidgetDefinition = {
  component: ImageComp,
  widgetName: "Image",
  widgetIcon: ImageIcon,
  widgetLabel: "Image",
  category: "Basic",
  defaultProperties: {
    ...FILTERED_COMMON_PROPS,
    width: { ...PROPERTY_SCHEMAS.width, value: 120 },
    height: { ...PROPERTY_SCHEMAS.height, value: 120 },
    backgroundColor: { ...PROPERTY_SCHEMAS.backgroundColor, value: "transparent" },
    imagePath: PROPERTY_SCHEMAS.imagePath,
    keepAspectRatio: PROPERTY_SCHEMAS.keepAspectRatio,
  },
};
