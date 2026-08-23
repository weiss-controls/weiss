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

type StrPair = [string, string];

const StrRecordProperty: React.FC<StrRecordPropertyProps> = ({
  propName,
  label,
  value,
  onChange,
}) => {
  const normalizeItems = React.useCallback((record: PropertyValue): StrPair[] => {
    if (typeof record !== "object" || record === null || Array.isArray(record)) {
      return [["", ""]];
    }

    const entries = Object.entries(record).map(([k, v]) => [k, String(v)] as StrPair);
    return entries.length > 0 ? entries : [["", ""]];
  }, []);

  const [localItems, setLocalItems] = React.useState<StrPair[]>(() => normalizeItems(value));

  React.useEffect(() => {
    setLocalItems(normalizeItems(value));
  }, [normalizeItems, value]);

  const commitItems = React.useCallback(
    (newItems: StrPair[]) => {
      onChange(propName, Object.fromEntries(newItems));
    },
    [onChange, propName],
  );

  const normalizeKey = React.useCallback((key: string) => {
    if (!key.trim()) return key;
    if (/^\$\(.+\)$/.test(key)) return key;
    return `$(${key})`;
  }, []);

  const handleKeyChange = (index: number, newKey: string) => {
    const newEntries = [...localItems];
    const [, val] = newEntries[index];
    newEntries[index] = [newKey, val];
    setLocalItems(newEntries);
  };

  const handleKeyCommit = (index: number) => {
    const newEntries = [...localItems];
    const [key, val] = newEntries[index];
    const wrappedKey = normalizeKey(key);
    newEntries[index] = [wrappedKey, val];
    setLocalItems(newEntries);
    commitItems(newEntries);
  };

  const handleValueChange = (index: number, newVal: string) => {
    const newEntries = [...localItems];
    const [key] = newEntries[index];
    newEntries[index] = [key, newVal];
    setLocalItems(newEntries);
  };

  const handleValueCommit = () => {
    const newEntries = [...localItems];
    commitItems(newEntries);
  };

  const handleAdd = (index?: number) => {
    const newEntries = [...localItems];
    if (typeof index === "number") {
      newEntries.splice(index + 1, 0, ["", ""]);
    } else {
      newEntries.push(["", ""]);
    }
    setLocalItems(newEntries);
    commitItems(newEntries);
  };

  const handleRemove = (index: number) => {
    const newEntries = localItems.filter((_, i) => i !== index);
    const ensuredEntries: StrPair[] = newEntries.length > 0 ? newEntries : [["", ""]];
    setLocalItems(ensuredEntries);
    commitItems(ensuredEntries);
  };

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    console.warn(`StrRecordProperty expected Record<string,string>, got`, value);
    return null;
  }

  return (
    <>
      {localItems.map(([key, val], index) => (
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
            onBlur={() => handleKeyCommit(index)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleKeyCommit(index);
              }
            }}
            sx={{ flex: 1 }}
          />
          <TextField
            size="small"
            label="Value"
            value={val}
            onChange={(e) => handleValueChange(index, e.target.value)}
            onBlur={handleValueCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleValueCommit();
              }
            }}
            sx={{ flex: 1 }}
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

export default React.memo(StrRecordProperty);
