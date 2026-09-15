// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React from "react";
import List from "@mui/material/List";
import Divider from "@mui/material/Divider";
import ListSubheader from "@mui/material/ListSubheader";
import IconButton from "@mui/material/IconButton";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { PropertyKey, PropertyValue, WidgetProperty } from "@src/types/widgets";
import TextFieldProperty from "./Properties/TextFieldProperty";
import BooleanProperty from "./Properties/BooleanProperty";
import ColorProperty from "./Properties/ColorProperty";
import SelectProperty from "./Properties/SelectProperty";
import StrListProperty from "./Properties/StrListProperty";
import StrRecordProperty from "./Properties/StrRecordProperty";
import ColorListProperty from "./Properties/ColorListProperty";
import RepoFileProperty from "./Properties/RepoFileProperty";
import StateListProperty from "./Properties/StateListProperty";
import TabListProperty from "./Properties/TabListProperty";
import { FRONT_UI_ZIDX } from "@src/constants/constants";
import { Box } from "@mui/material";

interface PropertyGroupsProps {
  groupedProperties: Record<string, Record<string, WidgetProperty>>;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (category: string) => void;
  onChange: (propName: PropertyKey, newValue: PropertyValue) => void;
  widgetsKey: string;
}

const PropertyGroups: React.FC<PropertyGroupsProps> = ({
  groupedProperties,
  collapsedGroups,
  onToggleGroup,
  onChange,
  widgetsKey,
}) => {
  return (
    <>
      {Object.entries(groupedProperties).map(([category, props]) => {
        const collapsed = collapsedGroups[category] ?? false;

        return (
          <Box key={category} sx={{ mx: 1 }}>
            <ListSubheader
              onClick={() => onToggleGroup(category)}
              sx={{
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                userSelect: "none",
                zIndex: FRONT_UI_ZIDX - 1,
              }}
            >
              <IconButton
                size="small"
                sx={{
                  transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
                  transition: "transform 0.2s",
                  mr: 1,
                }}
              >
                <ChevronRightIcon fontSize="inherit" />
              </IconButton>
              {category}
            </ListSubheader>

            {!collapsed && (
              <List
                disablePadding
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  width: "100%",
                  justifyContent: "center",
                }}
              >
                {Object.entries(props).map(([propName, prop]) => {
                  const { selType, label, value, options, limits, category } = prop;

                  const commonProps = {
                    propName: propName as PropertyKey,
                    label,
                    value,
                    limits,
                    category,
                    onChange,
                  };
                  // Include widgetsKey so switching the selected widget(s) remounts the row
                  // even if the property name is the same across different widgets.
                  const key = `${widgetsKey}:${propName}`;

                  switch (selType) {
                    case "text":
                    case "number":
                      return <TextFieldProperty key={key} {...commonProps} selType={selType} />;

                    case "strList":
                      return <StrListProperty key={key} {...commonProps} />;

                    case "strRecord":
                      return <StrRecordProperty key={key} {...commonProps} />;

                    case "boolean":
                      return <BooleanProperty key={key} {...commonProps} />;

                    case "colorSel":
                      return <ColorProperty key={key} {...commonProps} />;

                    case "colorSelList":
                      return <ColorListProperty key={key} {...commonProps} />;

                    case "select":
                      return <SelectProperty key={key} {...commonProps} options={options ?? []} />;

                    case "repoFile":
                      return <RepoFileProperty key={key} {...commonProps} accept={options} />;

                    case "stateList":
                      return <StateListProperty key={key} {...commonProps} />;

                    case "tabList":
                      return <TabListProperty key={key} {...commonProps} />;

                    default:
                      return null;
                  }
                })}
              </List>
            )}
            <Divider />
          </Box>
        );
      })}
    </>
  );
};

export default React.memo(PropertyGroups);
