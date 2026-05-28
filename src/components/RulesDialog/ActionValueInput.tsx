// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React from "react";
import { Checkbox, TextField, Select, MenuItem } from "@mui/material";
import type { PropertyKey, PropertyValue } from "@src/types/widgets";
import { PROPERTY_SCHEMAS } from "@src/types/widgetProperties";
import ColorSwatch from "./ColorSwatch";
import MacroOverrideEditor from "./MacroOverrideEditor";

export interface ActionValueInputProps {
  propKey: PropertyKey;
  value: PropertyValue;
  /** Required for strRecord properties (e.g. globalMacros, macros). */
  baseValue?: Record<string, string>;
  onChange: (v: PropertyValue) => void;
}

const ActionValueInput: React.FC<ActionValueInputProps> = ({
  propKey,
  value,
  baseValue,
  onChange,
}) => {
  const schema = PROPERTY_SCHEMAS[propKey];
  if (!schema) return null;

  const selType = schema.selType;

  if (selType === "colorSel") {
    return (
      <ColorSwatch value={(value as string) || (schema.value as string)} onChange={onChange} />
    );
  }

  if (selType === "boolean") {
    return (
      <Checkbox
        size="small"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  }

  if (selType === "number") {
    return (
      <TextField
        size="small"
        type="number"
        value={value as number}
        onChange={(e) => onChange(Number(e.target.value))}
        sx={{ width: 100 }}
        slotProps={{ htmlInput: { step: "any" } }}
      />
    );
  }

  if (selType === "strRecord" && baseValue !== undefined) {
    return (
      <MacroOverrideEditor
        baseValue={baseValue}
        delta={(value as Record<string, string>) ?? {}}
        onChange={(delta) => onChange(delta)}
      />
    );
  }

  if (selType === "select" && schema.options) {
    return (
      <Select
        size="small"
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
        sx={{ minWidth: 120 }}
      >
        {schema.options.map((opt) => (
          <MenuItem key={opt} value={opt}>
            {opt}
          </MenuItem>
        ))}
      </Select>
    );
  }

  // text / fallback
  return (
    <TextField
      size="small"
      value={value as string}
      onChange={(e) => onChange(e.target.value)}
      sx={{ flex: 1, minWidth: 80 }}
    />
  );
};

export default ActionValueInput;
