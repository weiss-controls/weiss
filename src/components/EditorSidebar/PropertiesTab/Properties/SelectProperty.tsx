// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

// src/components/PropertyFields/SelectProperty.tsx
import React from "react";
import ListItem from "@mui/material/ListItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import ButtonGroup from "@mui/material/ButtonGroup";
import IconButton from "@mui/material/IconButton";
import {
  FormatAlignLeft,
  FormatAlignCenter,
  FormatAlignRight,
  VerticalAlignTop,
  VerticalAlignCenter,
  VerticalAlignBottom,
} from "@mui/icons-material";

import type { SelectChangeEvent } from "@mui/material/Select";
import type { PropertyKey, PropertyValue } from "@src/types/widgets";

interface SelectPropertyProps {
  propName: PropertyKey;
  label: string;
  value: PropertyValue;
  options: string[];
  category: string;
  onChange: (propName: PropertyKey, newValue: PropertyValue) => void;
}

const SelectProperty: React.FC<SelectPropertyProps> = ({
  propName,
  label,
  value,
  options,
  onChange,
}) => {
  const handleChange = (newValue: string) => {
    onChange(propName, newValue);
  };

  const isVAlign = propName === "textVAlign";
  const isHAlign = propName === "textHAlign";

  // Icons for alignment buttons
  const items = isVAlign
    ? [
        { key: "top", icon: <VerticalAlignTop /> },
        { key: "middle", icon: <VerticalAlignCenter /> },
        { key: "bottom", icon: <VerticalAlignBottom /> },
      ]
    : isHAlign
      ? [
          { key: "left", icon: <FormatAlignLeft /> },
          { key: "center", icon: <FormatAlignCenter /> },
          { key: "right", icon: <FormatAlignRight /> },
        ]
      : [];

  return (
    <ListItem
      key={propName}
      disablePadding
      sx={{
        px: 2,
        py: 1,
        display: "flex",
        flexBasis: "50%",
        flexGrow: 1,
        justifyContent: isHAlign || isVAlign ? "center" : "flex-start",
      }}
    >
      {isHAlign || isVAlign ? (
        <ButtonGroup size="small">
          {items.map((item) => (
            <IconButton
              key={item.key}
              onClick={() => handleChange(item.key)}
              color={value === item.key ? "primary" : "default"}
              size="small"
            >
              {item.icon}
            </IconButton>
          ))}
        </ButtonGroup>
      ) : (
        <FormControl fullWidth size="small">
          <InputLabel>{label}</InputLabel>
          <Select
            label={label}
            value={value as string}
            onChange={(e: SelectChangeEvent) => handleChange(e.target.value)}
          >
            {options.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </ListItem>
  );
};

export default React.memo(SelectProperty);
