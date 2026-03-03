// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

// src/components/PropertyFields/StrListProperty.tsx
import React from "react";
import ListItem from "@mui/material/ListItem";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import type { PropertyKey, PropertyValue } from "@src/types/widgets";

interface StrListPropertyProps {
  propName: PropertyKey;
  label: string;
  value: PropertyValue;
  category: string;
  onChange: (propName: PropertyKey, newValue: PropertyValue) => void;
}

const StrListProperty: React.FC<StrListPropertyProps> = ({ propName, label, value, onChange }) => {
  if (!Array.isArray(value)) {
    console.warn(`StrListProperty expected string[], got`, value);
    return null;
  }

  const items = value.length > 0 ? value : [""];

  const handleChange = (index: number, newVal: string) => {
    const newArr = [...items];
    newArr[index] = newVal;
    onChange(propName, newArr);
  };

  const handleAdd = (index?: number) => {
    const newArr = [...items];
    if (typeof index === "number") {
      newArr.splice(index + 1, 0, "");
    } else {
      newArr.push("");
    }
    onChange(propName, newArr);
  };

  const handleRemove = (index: number) => {
    const newArr = items.filter((_, i) => i !== index);
    onChange(propName, newArr.length > 0 ? newArr : [""]);
  };

  return (
    <>
      {items.map((val, index) => (
        <ListItem
          key={index}
          disablePadding
          sx={{ px: 2, py: 1, gap: 1 }}
          title={`${label} ${index}`}
        >
          <TextField
            fullWidth
            size="small"
            label={`${label} ${index}`}
            value={val}
            onChange={(e) => handleChange(index, e.target.value)}
          />
          <IconButton color="primary" onClick={() => handleAdd(index)}>
            <AddIcon />
          </IconButton>
          <IconButton
            color="error"
            onClick={() => handleRemove(index)}
            disabled={items.length === 1}
          >
            <RemoveIcon />
          </IconButton>
        </ListItem>
      ))}
    </>
  );
};

export default React.memo(StrListProperty);
