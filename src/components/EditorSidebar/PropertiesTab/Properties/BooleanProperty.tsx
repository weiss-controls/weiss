// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

// src/components/PropertyFields/BooleanProperty.tsx
import React from "react";
import { FormControlLabel, Checkbox, ListItem, IconButton } from "@mui/material";
import { FormatBold, FormatItalic, FormatUnderlined } from "@mui/icons-material";
import type { PropertyKey, PropertyValue } from "@src/types/widgets"; // Adjust path as needed
import { COLORS } from "@src/constants/constants";

interface BooleanPropertyProps {
  propName: PropertyKey;
  label: string;
  value: PropertyValue;
  category: string;
  onChange: (propName: PropertyKey, newValue: PropertyValue) => void;
}

const BooleanProperty: React.FC<BooleanPropertyProps> = ({ propName, label, value, onChange }) => {
  const isBold = propName === "fontBold";
  const isItalic = propName === "fontItalic";
  const isUnderlined = propName === "fontUnderlined";
  const IconComp = isBold ? FormatBold : isItalic ? FormatItalic : FormatUnderlined;

  // If it's bold or italic, render as icon buttons
  if (isBold || isItalic || isUnderlined) {
    return (
      <ListItem
        key={propName}
        disablePadding
        sx={{
          px: 2,
          py: 1,
          display: "flex",
          width: "25%",
          flexGrow: 1,
          justifyContent: "center",
        }}
      >
        <IconButton
          color={value ? "primary" : "default"}
          size="small"
          onClick={() => onChange(propName, !value)}
        >
          <IconComp />
        </IconButton>
      </ListItem>
    );
  }

  // Default boolean checkbox
  return (
    <ListItem key={propName} disablePadding sx={{ px: 2 }}>
      <FormControlLabel
        control={
          <Checkbox
            checked={!!value}
            size="small"
            onChange={(e) => onChange(propName, e.target.checked)}
            style={{ color: COLORS.midDarkBlue }}
          />
        }
        label={label}
      />
    </ListItem>
  );
};

export default React.memo(BooleanProperty);
