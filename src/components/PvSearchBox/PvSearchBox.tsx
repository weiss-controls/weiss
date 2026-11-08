// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { useState, useEffect } from "react";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";

export interface PvSearchBoxProps {
  value: string[];
  onChange: (_: any, pvs: string[]) => void;
}

export default function PvSearchBox({ value, onChange }: PvSearchBoxProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!inputValue.trim()) {
      setOptions([]);
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        const url = `${import.meta.env.VITE_EPICS_ARCHIVER_URL}/mgmt/bpl/getAllPVs?pv=${encodeURIComponent(
          inputValue,
        )}*&limit=50`;

        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: string[] = await response.json();
        setOptions(Array.isArray(data) ? data : []);
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Error fetching PV status:", error);
          setOptions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [inputValue]);

  return (
    <Autocomplete
      multiple
      sx={{ width: 450 }}
      value={value}
      inputValue={inputValue}
      options={options}
      loading={loading}
      filterOptions={(x) => x}
      isOptionEqualToValue={(option, value) => option === value}
      onChange={onChange}
      onInputChange={(_, newInputValue, reason) => {
        if (reason === "reset") {
          setInputValue("");
        } else {
          setInputValue(newInputValue);
        }
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Search & Select PVs"
          placeholder="Type PV name..."
          variant="outlined"
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              endAdornment: loading ? <CircularProgress color="inherit" size={20} /> : null,
            },
          }}
        />
      )}
    />
  );
}
