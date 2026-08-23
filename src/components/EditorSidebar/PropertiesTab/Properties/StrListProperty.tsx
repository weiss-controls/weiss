// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

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
  const normalizeItems = React.useCallback((incoming: PropertyValue): string[] => {
    if (!Array.isArray(incoming)) {
      return [""];
    }
    const normalized = incoming.map((item) => (typeof item === "string" ? item : ""));
    return normalized.length > 0 ? normalized : [""];
  }, []);

  const [localItems, setLocalItems] = React.useState<string[]>(() => normalizeItems(value));

  React.useEffect(() => {
    setLocalItems(normalizeItems(value));
  }, [normalizeItems, value]);

  const commitItems = React.useCallback(
    (newItems: string[]) => {
      onChange(propName, newItems);
    },
    [onChange, propName],
  );

  const handleChange = (index: number, newVal: string) => {
    const newArr = [...localItems];
    newArr[index] = newVal;
    setLocalItems(newArr);
  };

  const handleCommit = () => {
    commitItems(localItems);
  };

  const handleAdd = (index?: number) => {
    const newArr = [...localItems];
    if (typeof index === "number") {
      newArr.splice(index + 1, 0, "");
    } else {
      newArr.push("");
    }
    setLocalItems(newArr);
    commitItems(newArr);
  };

  const handleRemove = (index: number) => {
    const newArr = localItems.filter((_, i) => i !== index);
    const ensured = newArr.length > 0 ? newArr : [""];
    setLocalItems(ensured);
    commitItems(ensured);
  };

  if (!Array.isArray(value)) {
    console.warn(`StrListProperty expected string[], got`, value);
    return null;
  }

  return (
    <>
      {localItems.map((val, index) => (
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
            onBlur={handleCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCommit();
              }
            }}
          />
          <IconButton color="primary" onClick={() => handleAdd(index)}>
            <AddIcon />
          </IconButton>
          <IconButton
            color="error"
            onClick={() => handleRemove(index)}
            disabled={localItems.length === 1}
          >
            <RemoveIcon />
          </IconButton>
        </ListItem>
      ))}
    </>
  );
};

export default React.memo(StrListProperty);
