// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useState } from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import AlarmBorder from "@components/AlarmBorder/AlarmBorder";
import { useUIContext } from "@src/context/useUIContext";
import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import IconButton from "@mui/material/IconButton";
import FormControl from "@mui/material/FormControl";
import OutlinedInput from "@mui/material/OutlinedInput";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import type { WidgetProperties } from "@src/types/widgets";
import { FLEX_ALIGN_MAP } from "@src/constants/constants";
import { useWSActionsContext } from "@src/context/useEpicsWSContext";

/**
 * This component is a placeholder for FormControl to correctly set the shrink label state on SSR.
 */
function SSRInitialFilled(_: BaseNumberField.Root.Props) {
  return null;
}
SSRInitialFilled.muiName = "Input";

function NumberField({
  id: idProp,
  label,
  error,
  size = "medium",
  p,
  onChange,
  ...other
}: BaseNumberField.Root.Props & {
  label?: React.ReactNode;
  size?: "small" | "medium";
  error?: boolean;
  p: WidgetProperties;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const { inEditMode } = useUIContext();
  let id = React.useId();
  if (idProp) {
    id = idProp;
  }
  return (
    <BaseNumberField.Root
      {...other}
      render={(props, state) => (
        <FormControl
          size={size}
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: FLEX_ALIGN_MAP[p.textHAlign?.value ?? "left"],
            alignItems: FLEX_ALIGN_MAP[p.textVAlign?.value ?? "middle"],
            backgroundColor: p.backgroundColor?.value,
            borderRadius: p.borderRadius?.value,
            borderStyle: p.borderStyle?.value,
            borderWidth: p.borderWidth?.value,
            borderColor: p.borderColor?.value,
            textTransform: "none",
            minWidth: 0,
            minHeight: 0,
            padding: 0,
            pointerEvents: inEditMode ? "none" : "auto",
            overflow: "hidden",
            "& .MuiOutlinedInput-root": {
              width: "100%",
              height: "100%",
            },
            "& .MuiInputBase-input": {
              width: "100%",
              height: "100%",
            },
          }}
          ref={props.ref}
          disabled={state.disabled}
          required={state.required}
          error={error}
          variant="outlined"
        >
          {props.children}
        </FormControl>
      )}
    >
      <SSRInitialFilled {...other} />
      <InputLabel htmlFor={id}>{label}</InputLabel>
      <BaseNumberField.Input
        id={id}
        render={(props, state) => (
          <OutlinedInput
            label={label}
            inputRef={props.ref}
            value={state.inputValue}
            onBlur={props.onBlur}
            onChange={props.onChange}
            onKeyUp={props.onKeyUp}
            onKeyDown={props.onKeyDown}
            onFocus={props.onFocus}
            slotProps={{
              input: {
                ...props,
                sx: {
                  fontSize: p.fontSize?.value,
                  fontFamily: p.fontFamily?.value,
                  fontWeight: p.fontBold?.value ? "bold" : "normal",
                  fontStyle: p.fontItalic?.value ? "italic" : "normal",
                  textDecoration: p.fontUnderlined?.value ? "underline" : "none",
                  color: p.textColor?.value,
                },
              },
            }}
            endAdornment={
              <InputAdornment
                position="end"
                sx={{
                  flexDirection: "column",
                  width: "100%",
                  height: "100%",
                  maxHeight: "unset",
                  alignSelf: "stretch",
                  borderLeft: "1px solid",
                  borderColor: "divider",
                  ml: 0,
                  "& button": {
                    py: 0,
                    flex: 1,
                    borderRadius: 0.5,
                  },
                }}
              >
                <BaseNumberField.Increment
                  render={<IconButton size={size} aria-label="Increase" />}
                >
                  <KeyboardArrowUpIcon fontSize={size} sx={{ transform: "translateY(2px)" }} />
                </BaseNumberField.Increment>

                <BaseNumberField.Decrement
                  render={<IconButton size={size} aria-label="Decrease" />}
                >
                  <KeyboardArrowDownIcon fontSize={size} sx={{ transform: "translateY(-2px)" }} />
                </BaseNumberField.Decrement>
              </InputAdornment>
            }
            sx={{ pr: 0 }}
          />
        )}
      />
    </BaseNumberField.Root>
  );
}

const SpinnerComp: React.FC<WidgetUpdate> = ({ data }) => {
  const p = data.editableProperties;
  const pvData = data.pvData;
  const { writePVValue } = useWSActionsContext();
  const { inEditMode } = useUIContext();
  const [inputValue, setInputValue] = useState<string>("");

  if (!p.visible?.value) return null;
  const handleWrite = (value: number | string) => {
    if (inEditMode) return;
    if (p.pvName?.value) {
      writePVValue(p.pvName.value, value);
    }
  };

  return (
    <AlarmBorder alarmData={pvData?.alarm} enable={p.alarmBorder?.value}>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <NumberField label={p.pvName?.value} size="small" p={p} onChange: {(e) => setInputValue(e.target.value)} />
      </div>
    </AlarmBorder>
  );
};

export { SpinnerComp };
