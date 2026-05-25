// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React from "react";
import { Box, Typography, TextField } from "@mui/material";

export interface MacroOverrideEditorProps {
  /** All macro keys that exist on the widget/grid; only these keys are shown. */
  baseValue: Record<string, string>;
  /** The partial delta of overrides set so far. Keys absent = no override. */
  delta: Record<string, string>;
  onChange: (delta: Record<string, string>) => void;
}

const MacroOverrideEditor: React.FC<MacroOverrideEditorProps> = ({
  baseValue,
  delta,
  onChange,
}) => {
  const keys = Object.keys(baseValue);
  if (keys.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
        No macro keys defined.
      </Typography>
    );
  }
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, flex: 1 }}>
      {keys.map((key) => (
        <Box key={key} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Typography variant="caption" sx={{ width: 80, flexShrink: 0 }}>
            {key}
          </Typography>
          <TextField
            size="small"
            placeholder="(no override)"
            value={delta[key] ?? ""}
            onChange={(e) => {
              const next = { ...delta };
              if (e.target.value === "") {
                delete next[key];
              } else {
                next[key] = e.target.value;
              }
              onChange(next);
            }}
            sx={{ flex: 1, minWidth: 80 }}
          />
        </Box>
      ))}
    </Box>
  );
};

export default MacroOverrideEditor;
