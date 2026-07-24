// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React from "react";
import ListItem from "@mui/material/ListItem";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import type { PropertyKey, PropertyValue } from "@src/types/widgets";

interface StrRecordPropertyProps {
  propName: PropertyKey;
  label: string;
  value: PropertyValue;
  category: string;
  onChange: (propName: PropertyKey, newValue: PropertyValue) => void;
}

const StrRecordProperty: React.FC<StrRecordPropertyProps> = ({
  propName,
  label,
  value,
  onChange,
}) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    console.warn(`StrRecordProperty expected Record<string,string>, got`, value);
    return null;
  }

  const entries = Object.entries(value);
  const items = entries.length > 0 ? entries : [["", ""]];

  const handleKeyChange = (index: number, newKey: string) => {
    const newEntries = [...items];
    const [, val] = newEntries[index];
    newEntries[index] = [newKey, val];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    onChange(propName, Object.fromEntries(newEntries));
  };

  const handleKeyBlur = (index: number) => {
    const entries = Object.entries(value);
    const [key, val] = entries[index];
    if (!key.trim()) return;

    // wrap if not already $(KEY)
    if (!/^\$\(.+\)$/.test(key)) {
      const wrappedKey = `$(${key})`;
      const newEntries = [...entries];
      newEntries[index] = [wrappedKey, val];
      onChange(propName, Object.fromEntries(newEntries));
    }
  };

  const handleValueChange = (index: number, newVal: string) => {
    const newEntries = [...items];
    const [key] = newEntries[index];
    newEntries[index] = [key, newVal];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    onChange(propName, Object.fromEntries(newEntries));
  };

  const handleAdd = (index?: number) => {
    const newEntries = [...items];
    if (typeof index === "number") {
      newEntries.splice(index + 1, 0, ["", ""]);
    } else {
      newEntries.push(["", ""]);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    onChange(propName, Object.fromEntries(newEntries));
  };

  const handleRemove = (index: number) => {
    const newEntries = items.filter((_, i) => i !== index);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    onChange(propName, Object.fromEntries(newEntries.length > 0 ? newEntries : [["", ""]]));
  };

  return (
    <>
      {items.map(([key, val], index) => (
        <ListItem
          key={index}
          disablePadding
          sx={{ px: 2, py: 1, gap: 1 }}
          title={`${label} ${index}`}
        >
          <TextField
            size="small"
            label={`${label} ${index}`}
            value={key}
            onChange={(e) => handleKeyChange(index, e.target.value)}
            onBlur={() => handleKeyBlur(index)}
            sx={{ flex: 1 }}
          />
          <TextField
            size="small"
            label="Value"
            value={val}
            onChange={(e) => handleValueChange(index, e.target.value)}
            sx={{ flex: 1 }}
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

export default React.memo(StrRecordProperty);
