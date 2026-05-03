// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Marco Montevechi, André Favoto

import React, { useState, useEffect } from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import AlarmBorder from "@components/AlarmBorder/AlarmBorder";
import { useUIContext } from "@src/context/useUIContext";
import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import FormControl from "@mui/material/FormControl";
import OutlinedInput from "@mui/material/OutlinedInput";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import Typography from "@mui/material/Typography";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useWSActionsContext } from "@src/context/useEpicsWSContext";
import { FLEX_ALIGN_MAP } from "@src/constants/constants";

const SpinnerComp: React.FC<WidgetUpdate> = ({ data }) => {
  const { writePVValue } = useWSActionsContext();
  const { inEditMode } = useUIContext();
  const [editValue, setEditValue] = useState<number | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const id = React.useId();

  const p = data.editableProperties;
  const pvData = data.pvData;
  const units =
    p.unitsFromPV?.value && pvData?.display?.units ? pvData.display.units : p.units?.value;
  const pvNumValue = pvData?.value !== undefined ? Number(pvData.value) : null;
  const labelShrink = pvNumValue !== null || isFocused;
  const min = (p.limitsFromPV?.value ? pvData?.display?.limitLow : p.min?.value) ?? 0;
  const max = (p.limitsFromPV?.value ? pvData?.display?.limitHigh : p.max?.value) ?? 1;

  useEffect(() => {
    if (inEditMode) {
      setIsFocused(false);
      setEditValue(null);
    }
  }, [inEditMode]);

  if (!p.visible?.value) return null;

  const handleWrite = (value: number | null) => {
    if (inEditMode || value === null) return;
    if (p.pvName?.value) {
      writePVValue(p.pvName.value, value);
    }
  };

  return (
    <AlarmBorder alarmData={pvData?.alarm} enable={p.alarmBorder?.value}>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <BaseNumberField.Root
          value={isFocused ? editValue : pvNumValue}
          disabled={!!p.disabled?.value}
          onValueChange={(v) => setEditValue(v)}
          min={min}
          max={max}
          onValueCommitted={(value, { reason }) => {
            if (
              reason === "increment-press" ||
              reason === "decrement-press" ||
              reason === "keyboard"
            ) {
              handleWrite(value);
            }
          }}
          render={(props, state) => (
            <FormControl
              size="small"
              sx={{
                width: "100%",
                height: "100%",
                display: "flex",
                backgroundColor: p.backgroundColor?.value,
                borderRadius: p.borderRadius?.value,
                borderStyle: p.borderStyle?.value,
                borderWidth: p.borderWidth?.value,
                borderColor: p.borderColor?.value,
                minWidth: 0,
                minHeight: 0,
                padding: 0,
                pointerEvents: inEditMode ? "none" : "auto",
                "& .MuiOutlinedInput-root": { width: "100%", height: "100%" },
                "& .MuiInputBase-input": { width: "100%" },
              }}
              ref={props.ref}
              disabled={state.disabled}
              variant="outlined"
            >
              {props.children}
            </FormControl>
          )}
        >
          <InputLabel htmlFor={id} shrink={labelShrink}>
            {p.pvName?.value}
          </InputLabel>
          <BaseNumberField.Input
            id={id}
            render={(props, state) => (
              <OutlinedInput
                label={p.pvName?.value}
                notched={labelShrink}
                inputRef={props.ref}
                value={state.inputValue}
                onBlur={(e) => {
                  props.onBlur?.(e);
                  setIsFocused(false);
                  setEditValue(null);
                }}
                onChange={props.onChange}
                onKeyUp={props.onKeyUp}
                onFocus={(e) => {
                  props.onFocus?.(e);
                  setIsFocused(true);
                  setEditValue(pvNumValue);
                }}
                slotProps={{
                  input: {
                    ...props,
                    onKeyDown: (e) => {
                      props.onKeyDown?.(e);
                      if (e.key === "Enter") {
                        handleWrite(editValue);
                      }
                    },
                    title: p.tooltip?.value ?? "",
                    sx: {
                      fontSize: p.fontSize?.value,
                      fontFamily: p.fontFamily?.value,
                      fontWeight: p.fontBold?.value ? "bold" : "normal",
                      fontStyle: p.fontItalic?.value ? "italic" : "normal",
                      textDecoration: p.fontUnderlined?.value ? "underline" : "none",
                      color: p.textColor?.value,
                      textAlign: (p.textHAlign?.value ??
                        "left") as React.CSSProperties["textAlign"],
                    },
                  },
                }}
                endAdornment={
                  <InputAdornment
                    position="end"
                    sx={{
                      height: "100%",
                      maxHeight: "unset",
                      alignSelf: "stretch",
                      ml: 0,
                      p: 0,
                    }}
                  >
                    {units && (
                      <Typography
                        variant="caption"
                        sx={{
                          px: 0.5,
                          color: "text.secondary",
                          alignSelf: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {units}
                      </Typography>
                    )}
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        height: "100%",
                        borderLeft: "1px solid",
                        borderColor: "divider",
                        "& button": {
                          py: 0,
                          px: 0.5,
                          flex: 1,
                          borderRadius: 0,
                          height: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        },
                      }}
                    >
                      <BaseNumberField.Increment render={<IconButton aria-label="Increase" />}>
                        <KeyboardArrowUpIcon sx={{ transform: "translateY(2px)" }} />
                      </BaseNumberField.Increment>
                      <BaseNumberField.Decrement render={<IconButton aria-label="Decrease" />}>
                        <KeyboardArrowDownIcon sx={{ transform: "translateY(-2px)" }} />
                      </BaseNumberField.Decrement>
                    </Box>
                  </InputAdornment>
                }
                sx={{
                  pr: 0,
                  alignItems: FLEX_ALIGN_MAP[p.textVAlign?.value ?? "middle"],
                }}
              />
            )}
          />
        </BaseNumberField.Root>
      </div>
    </AlarmBorder>
  );
};

export { SpinnerComp };
