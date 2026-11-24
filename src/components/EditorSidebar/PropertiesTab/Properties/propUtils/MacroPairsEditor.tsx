// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import React, { useEffect, useState } from "react";
import { Box, IconButton, TextField } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import useCommitOnUnmount from "./useCommitOnUnmount";

type MacroPair = [string, string];

function macrosToPairs(macros: Record<string, string>): MacroPair[] {
  const entries = Object.entries(macros);
  return entries.length > 0 ? entries : [["", ""]];
}

/** Compact key/value macro editor for one row of a list property (a tab, an instance, ...). */
const MacroPairsEditor: React.FC<{
  macros: Record<string, string>;
  onCommit: (macros: Record<string, string>) => void;
}> = ({ macros, onCommit }) => {
  const [localPairs, setLocalPairs] = useState<MacroPair[]>(() => macrosToPairs(macros));

  useEffect(() => {
    setLocalPairs(macrosToPairs(macros));
  }, [macros]);

  const commit = (pairs: MacroPair[]) => {
    const filtered = pairs.filter(([k]) => k.trim() !== "");
    onCommit(Object.fromEntries(filtered));
  };

  const normalizeKey = (key: string) => {
    if (!key.trim()) return key;
    return /^\$\(.+\)$/.test(key) ? key : `$(${key})`;
  };

  useCommitOnUnmount(() => {
    const normalized = localPairs.map(([k, v]) => [normalizeKey(k), v] as MacroPair);
    const filtered = normalized.filter(([k]) => k.trim() !== "");
    if (JSON.stringify(Object.fromEntries(filtered)) !== JSON.stringify(macros)) {
      commit(normalized);
    }
  });

  const handleKeyCommit = (index: number) => {
    const newPairs = [...localPairs];
    const [key, val] = newPairs[index];
    newPairs[index] = [normalizeKey(key), val];
    setLocalPairs(newPairs);
    commit(newPairs);
  };

  const handleAdd = () => {
    const newPairs = [...localPairs, ["", ""] as MacroPair];
    setLocalPairs(newPairs);
  };

  const handleRemove = (index: number) => {
    const newPairs = localPairs.filter((_, i) => i !== index);
    const ensured = newPairs.length > 0 ? newPairs : [["", ""] as MacroPair];
    setLocalPairs(ensured);
    commit(ensured);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, width: "100%" }}>
      {localPairs.map(([key, val], index) => (
        <Box key={index} sx={{ display: "flex", gap: 0.5 }}>
          <TextField
            size="small"
            label="Macro"
            value={key}
            onChange={(e) => {
              const newPairs = [...localPairs];
              newPairs[index] = [e.target.value, val];
              setLocalPairs(newPairs);
            }}
            onBlur={() => handleKeyCommit(index)}
            sx={{ flex: 1 }}
            slotProps={{ htmlInput: { style: { fontSize: 12 } } }}
          />
          <TextField
            size="small"
            label="Value"
            value={val}
            onChange={(e) => {
              const newPairs = [...localPairs];
              newPairs[index] = [key, e.target.value];
              setLocalPairs(newPairs);
            }}
            onBlur={() => commit(localPairs)}
            sx={{ flex: 1 }}
            slotProps={{ htmlInput: { style: { fontSize: 12 } } }}
          />
          <IconButton size="small" color="primary" onClick={handleAdd}>
            <AddIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleRemove(index)}
            disabled={localPairs.length === 1}
          >
            <RemoveIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
    </Box>
  );
};

export default MacroPairsEditor;
