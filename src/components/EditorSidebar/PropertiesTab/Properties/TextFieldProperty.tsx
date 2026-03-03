// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

// src/components/PropertyFields/TextFieldProperty.tsx
import React from "react";
import { TextField, ListItem } from "@mui/material";
import type { PropertyKey, PropertyLimits, PropertyValue } from "@src/types/widgets";
import LocalValueWrapper from "./LocalValueWrapper";

interface TextFieldPropertyProps {
  propName: PropertyKey;
  label: string;
  value: PropertyValue;
  selType: "text" | "number";
  limits?: PropertyLimits;
  category: string;
  onChange: (propName: PropertyKey, newValue: PropertyValue) => void;
}

const TextFieldProperty: React.FC<TextFieldPropertyProps> = (props) => {
  const { propName, label, value, selType, limits, onChange } = props;
  return (
    <ListItem
      key={propName}
      disablePadding
      sx={{
        px: 2,
        py: 1,
        display: "flex",
        flexBasis: selType === "number" ? "50%" : "100%",
        flexGrow: 1,
      }}
    >
      <LocalValueWrapper
        initial={value}
        render={(localVal, setLocalVal) => (
          <TextField
            fullWidth
            label={label}
            variant="outlined"
            size="small"
            type={selType}
            value={localVal}
            onChange={(e) => {
              let val: number | string = e.target.value;
              if (selType === "number") {
                if (val === "") {
                  // Allow empty string temporarily so user can edit freely
                  setLocalVal(val);
                  return;
                }
                const numVal = Number(val);
                if (!isNaN(numVal)) {
                  let limitedVal = numVal;
                  if (limits?.min !== undefined) limitedVal = Math.max(limitedVal, limits.min);
                  if (limits?.max !== undefined) limitedVal = Math.min(limitedVal, limits.max);
                  val = limitedVal;
                }
              }
              setLocalVal(val);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (selType === "number" && localVal === "") {
                  setLocalVal(value);
                  onChange(propName, value);
                  return;
                }
                if (localVal !== value) onChange(propName, localVal);
              }
            }}
            onBlur={() => {
              if (selType === "number" && localVal === "") {
                setLocalVal(value);
                onChange(propName, value);
                return;
              }
              if (localVal !== value) onChange(propName, localVal);
            }}
          />
        )}
      />
    </ListItem>
  );
};

export default React.memo(TextFieldProperty);
