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
import { FRONT_UI_ZIDX } from "@src/constants/constants";
import { Box } from "@mui/material";

interface PropertyGroupsProps {
  groupedProperties: Record<string, Record<string, WidgetProperty>>;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (category: string) => void;
  onChange: (propName: PropertyKey, newValue: PropertyValue) => void;
}

const PropertyGroups: React.FC<PropertyGroupsProps> = ({
  groupedProperties,
  collapsedGroups,
  onToggleGroup,
  onChange,
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

                  switch (selType) {
                    case "text":
                    case "number":
                      return (
                        <TextFieldProperty key={propName} {...commonProps} selType={selType} />
                      );

                    case "strList":
                      return <StrListProperty key={propName} {...commonProps} />;

                    case "strRecord":
                      return <StrRecordProperty key={propName} {...commonProps} />;

                    case "boolean":
                      return <BooleanProperty key={propName} {...commonProps} />;

                    case "colorSel":
                      return <ColorProperty key={propName} {...commonProps} />;

                    case "colorSelList":
                      return <ColorListProperty key={propName} {...commonProps} />;

                    case "select":
                      return (
                        <SelectProperty key={propName} {...commonProps} options={options ?? []} />
                      );

                    case "repoFile":
                      return <RepoFileProperty key={propName} {...commonProps} accept={options} />;

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
