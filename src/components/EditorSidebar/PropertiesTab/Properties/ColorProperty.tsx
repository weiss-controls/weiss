// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

// src/components/PropertyFields/ColorProperty.tsx
import React, { useState, useEffect } from "react";
import { Box, Typography, ListItem, Popover, IconButton } from "@mui/material";
import { Sketch } from "@uiw/react-color";
import { FormatColorText } from "@mui/icons-material";
import type { PropertyKey, PropertyValue } from "@src/types/widgets";
import { COLORS } from "@src/constants/constants";

interface ColorPropertyProps {
  propName: PropertyKey;
  label: string;
  value: PropertyValue;
  category: string;
  onChange: (propName: PropertyKey, newValue: PropertyValue) => void;
}

const ColorProperty: React.FC<ColorPropertyProps> = ({ propName, label, value, onChange }) => {
  const [localVal, setLocalVal] = useState(value as string);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setLocalVal(value as string);
  }, [value]);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    if (localVal !== value) {
      onChange(propName, localVal);
    }
  };

  const open = Boolean(anchorEl);
  const isFontColor = propName === "textColor";

  return (
    <ListItem
      key={propName}
      disablePadding
      sx={{
        px: 2,
        py: 1,
        display: "flex",
        flexBasis: isFontColor ? "25%" : "100%",
        flexGrow: 1,
        justifyContent: isFontColor ? "center" : "flex-start",
      }}
    >
      {isFontColor ? (
        <IconButton
          onClick={handleClick}
          size="small"
          sx={{
            color: localVal,
            width: "25%",
          }}
        >
          <FormatColorText />
        </IconButton>
      ) : (
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, width: "100%" }}>
          <Typography variant="body2" sx={{ width: "60%" }}>
            {label}
          </Typography>
          <Box
            onClick={handleClick}
            sx={{
              width: "35%",
              height: 20,
              border: `1px solid ${COLORS.lightGray}`,
              borderRadius: "4px",
              backgroundColor: localVal,
              cursor: "pointer",
            }}
          />
        </Box>
      )}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
      >
        <Sketch
          color={localVal}
          presetColors={Object.values(COLORS)}
          onChange={(color) => {
            const { r, g, b, a } = color.rgba;
            const rgbaString = `rgba(${r}, ${g}, ${b}, ${a})`;
            setLocalVal(rgbaString);
            onChange(propName, rgbaString);
          }}
        />
      </Popover>
    </ListItem>
  );
};

export default React.memo(ColorProperty);
