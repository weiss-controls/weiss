// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import React from "react";
import { Box, IconButton, ListItem, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import type { InstanceEntry, PropertyKey, PropertyValue } from "@src/types/widgets";
import MacroPairsEditor from "./propUtils/MacroPairsEditor";

interface InstanceListPropertyProps {
  propName: PropertyKey;
  label: string;
  value: PropertyValue;
  category: string;
  onChange: (propName: PropertyKey, newValue: PropertyValue) => void;
}

function normalizeInstances(incoming: PropertyValue): InstanceEntry[] {
  if (!Array.isArray(incoming)) return [];
  return incoming.map((entry) => {
    const macros = (entry as Partial<InstanceEntry>).macros;
    return { macros: typeof macros === "object" && macros !== null ? macros : {} };
  });
}

/** Editor of a DisplayRepeater's instances: one macro table per instance. */
const InstanceListProperty: React.FC<InstanceListPropertyProps> = ({
  propName,
  label,
  value,
  onChange,
}) => {
  // Every edit is committed at once (macro rows commit on blur), so no local copy is needed.
  const instances = normalizeInstances(value);
  const commit = (next: InstanceEntry[]) => onChange(propName, next);

  const handleAdd = (index: number) => {
    const next = [...instances];
    // A new instance starts from the macro names of the one it follows, with empty values.
    const template = instances[index]?.macros ?? {};
    next.splice(index + 1, 0, {
      macros: Object.fromEntries(Object.keys(template).map((k) => [k, ""])),
    });
    commit(next);
  };

  return (
    <>
      <ListItem disablePadding sx={{ px: 2, pt: 1, pb: 0, justifyContent: "space-between" }}>
        <Typography variant="body2">
          {label} ({instances.length})
        </Typography>
        {instances.length === 0 && (
          <IconButton size="small" color="primary" onClick={() => handleAdd(-1)}>
            <AddIcon fontSize="small" />
          </IconButton>
        )}
      </ListItem>

      {instances.map((inst, index) => (
        <Box
          key={index}
          sx={{
            mx: 2,
            my: 0.5,
            p: 1,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Typography variant="caption" sx={{ color: "text.secondary", flex: 1 }}>
              Instance {index + 1}
            </Typography>
            <IconButton size="small" color="primary" onClick={() => handleAdd(index)}>
              <AddIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={() => commit(instances.filter((_, i) => i !== index))}
            >
              <RemoveIcon fontSize="small" />
            </IconButton>
          </Box>
          <MacroPairsEditor
            macros={inst.macros}
            onCommit={(macros) =>
              commit(instances.map((entry, i) => (i === index ? { macros } : entry)))
            }
          />
        </Box>
      ))}
    </>
  );
};

export default React.memo(InstanceListProperty);
