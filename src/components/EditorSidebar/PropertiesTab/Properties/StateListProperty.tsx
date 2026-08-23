// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useState } from "react";
import { Box, Typography, ListItem, Popover, IconButton, TextField } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { Sketch } from "@uiw/react-color";
import type { PropertyKey, PropertyValue, StateEntry } from "@src/types/widgets";
import { COLORS } from "@src/constants/constants";

interface StateListPropertyProps {
  propName: PropertyKey;
  label: string;
  value: PropertyValue;
  onChange: (propName: PropertyKey, newValue: PropertyValue) => void;
}

const DEFAULT_NEW_STATE: StateEntry = { value: "", color: COLORS.midGray, label: "" };

// Ensure at least 1 normal state + 1 fallback entry in local editing state
const normalizeStates = (incoming: PropertyValue): StateEntry[] => {
  if (!Array.isArray(incoming)) {
    return [{ value: "0", color: COLORS.offColor, label: "" }, { ...DEFAULT_NEW_STATE }];
  }

  const safeStates = incoming.map((entry) => {
    const candidate = entry as Partial<StateEntry>;
    return {
      value: String(candidate.value ?? ""),
      color: String(candidate.color ?? COLORS.midGray),
      label: String(candidate.label ?? ""),
    } satisfies StateEntry;
  });

  return safeStates.length >= 2
    ? safeStates
    : [{ value: "0", color: COLORS.offColor, label: "" }, { ...DEFAULT_NEW_STATE }];
};

const StateListProperty: React.FC<StateListPropertyProps> = ({
  propName,
  label,
  value,
  onChange,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [localStates, setLocalStates] = useState<StateEntry[]>(() => normalizeStates(value));

  React.useEffect(() => {
    setLocalStates(normalizeStates(value));
  }, [value]);

  if (!Array.isArray(value)) {
    console.warn(`StateListProperty expected StateEntry[], got`, value);
    return null;
  }

  const states = localStates;

  const fallbackIndex = states.length - 1;

  const commit = (newStates: StateEntry[]) => {
    onChange(propName, newStates);
  };

  const handleValueChange = (index: number, field: keyof StateEntry, newVal: string) => {
    const newStates = states.map((s, i) => (i === index ? { ...s, [field]: newVal } : s));
    setLocalStates(newStates);
  };

  const handleValueCommit = () => {
    commit(states);
  };

  const handleColorChange = (newColor: string) => {
    if (activeIndex === null) return;
    const newStates = states.map((s, i) =>
      i === activeIndex
        ? {
            ...s,
            color: newColor,
          }
        : s,
    );
    setLocalStates(newStates);
    commit(newStates);
  };

  const handleColorClick = (event: React.MouseEvent<HTMLElement>, index: number) => {
    setAnchorEl(event.currentTarget);
    setActiveIndex(index);
  };

  const handleColorClose = () => {
    setAnchorEl(null);
    setActiveIndex(null);
  };

  const handleAdd = (index: number, isFallback: boolean) => {
    const newStates = [...states];
    // For the fallback row, insert before it; otherwise insert after
    const insertAt = isFallback ? index : index + 1;
    newStates.splice(insertAt, 0, { ...DEFAULT_NEW_STATE });
    setLocalStates(newStates);
    commit(newStates);
  };

  const handleRemove = (index: number) => {
    const newStates = states.filter((_, i) => i !== index);
    setLocalStates(newStates);
    commit(newStates);
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <ListItem disablePadding sx={{ px: 2, pt: 1, pb: 0 }}>
        <Typography variant="body2">{label}</Typography>
      </ListItem>

      {states.map((state, index) => {
        const isFallback = index === fallbackIndex;
        // Remove enabled only on non-fallback rows when there are more than 2 entries total
        const canRemove = !isFallback && states.length > 2;

        return (
          <ListItem
            key={index}
            disablePadding
            sx={{ px: 2, py: 0.5, display: "flex", alignItems: "center", gap: 0.5 }}
          >
            {/* Left section: index label + value field (normal) OR "Fallback:" spanning both (fallback).
                Fixed flex-basis keeps the color swatches aligned across all rows. */}
            <Box
              sx={{ flex: "0 0 25%", display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}
            >
              {isFallback ? (
                <Typography variant="caption" sx={{ color: "text.disabled", width: "100%" }}>
                  Fallback:
                </Typography>
              ) : (
                <>
                  <Typography variant="caption" sx={{ flex: "0 0 auto", color: "text.secondary" }}>
                    {index}:
                  </Typography>
                  <TextField
                    size="small"
                    label="Value"
                    value={state.value}
                    onChange={(e) => handleValueChange(index, "value", e.target.value)}
                    onBlur={handleValueCommit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleValueCommit();
                      }
                    }}
                    sx={{ flex: 1, minWidth: 0 }}
                    slotProps={{ htmlInput: { style: { fontSize: 12 } } }}
                  />
                </>
              )}
            </Box>

            {/* Color swatch */}
            <Box
              onClick={(e) => handleColorClick(e, index)}
              title="Pick color"
              sx={{
                flex: "0 0 10%",
                minWidth: "30px",
                height: 28,
                border: `2px solid ${COLORS.lightGray}`,
                borderRadius: "4px",
                backgroundColor: state.color,
                cursor: "pointer",
              }}
            />

            {/* Label */}
            <TextField
              size="small"
              label="Label"
              value={state.label}
              onChange={(e) => handleValueChange(index, "label", e.target.value)}
              onBlur={handleValueCommit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleValueCommit();
                }
              }}
              sx={{ flex: 1, minWidth: 0 }}
              slotProps={{ htmlInput: { style: { fontSize: 12 } } }}
            />

            <IconButton size="small" color="primary" onClick={() => handleAdd(index, isFallback)}>
              <AddIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={() => handleRemove(index)}
              disabled={!canRemove}
            >
              <RemoveIcon fontSize="small" />
            </IconButton>
          </ListItem>
        );
      })}

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleColorClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Sketch
          color={activeIndex !== null ? states[activeIndex]?.color : undefined}
          onChange={(color) => handleColorChange(color.hexa)}
        />
      </Popover>
    </>
  );
};

export default React.memo(StateListProperty);
