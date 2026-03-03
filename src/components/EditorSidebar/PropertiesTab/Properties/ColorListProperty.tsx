// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

// src/components/PropertyFields/ColorSelListProperty.tsx
import React, { useState, useEffect } from "react";
import { Box, Typography, ListItem, Popover, IconButton } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { Sketch } from "@uiw/react-color";
import type { PropertyKey, PropertyValue } from "@src/types/widgets";
import { COLORS } from "@src/constants/constants";

interface ColorSelListPropertyProps {
  propName: PropertyKey;
  label: string;
  value: PropertyValue; // expected: string[]
  onChange: (propName: PropertyKey, newValue: PropertyValue) => void;
}

const ColorSelListProperty: React.FC<ColorSelListPropertyProps> = ({
  propName,
  label,
  value,
  onChange,
}) => {
  const [colors, setColors] = useState<string[]>([]);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    const arr = (value as string[]) ?? [];
    const val = arr.length > 0 ? arr : ["rgba(0,0,0,1)"];
    setColors(val);
  }, [value]);

  if (!Array.isArray(value)) {
    console.warn(`ColorSelListProperty expected string[], got`, value);
    return null;
  }

  const commit = (newColors: string[]) => {
    setColors(newColors);
    onChange(propName, newColors);
  };

  const handleClick = (event: React.MouseEvent<HTMLElement>, index: number) => {
    setAnchorEl(event.currentTarget);
    setActiveIndex(index);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setActiveIndex(null);
  };

  const handleColorChange = (newColor: string) => {
    if (activeIndex === null) return;
    const newColors = [...colors];
    newColors[activeIndex] = newColor;
    commit(newColors);
  };

  const handleAdd = () => {
    commit([...colors, "rgba(0,0,0,1)"]);
  };

  const handleRemove = (index: number) => {
    const newColors = colors.filter((_, i) => i !== index);
    commit(newColors.length > 0 ? newColors : ["rgba(0,0,0,1)"]);
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <ListItem disablePadding sx={{ px: 2, py: 1 }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            width: "100%",
          }}
        >
          <Typography variant="body2">{label}</Typography>
          {colors.map((color, index) => (
            <Box key={index} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" sx={{ width: "60%" }}>
                Line {index}:
              </Typography>
              <Box
                onClick={(e) => handleClick(e, index)}
                sx={{
                  width: "35%",
                  height: 20,
                  border: `2px solid ${COLORS.lightGray}`,
                  borderRadius: "4px",
                  backgroundColor: color,
                  cursor: "pointer",
                }}
              />
              <IconButton color="primary" onClick={handleAdd}>
                <AddIcon />
              </IconButton>
              <IconButton
                color="error"
                onClick={() => handleRemove(index)}
                disabled={colors.length === 1}
              >
                <RemoveIcon />
              </IconButton>
            </Box>
          ))}
        </Box>
      </ListItem>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
      >
        {activeIndex !== null && (
          <Sketch
            color={colors[activeIndex]}
            presetColors={Object.values(COLORS)}
            onChange={(color) => {
              const { r, g, b, a } = color.rgba;
              const rgbaString = `rgba(${r}, ${g}, ${b}, ${a})`;
              handleColorChange(rgbaString);
            }}
          />
        )}
      </Popover>
    </>
  );
};

export default React.memo(ColorSelListProperty);
