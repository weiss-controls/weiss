// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useState } from "react";
import { Box, Popover } from "@mui/material";
import { Sketch } from "@uiw/react-color";
import { COLORS } from "@src/constants/constants";

export interface ColorSwatchProps {
  value: string;
  onChange: (color: string) => void;
}

const ColorSwatch: React.FC<ColorSwatchProps> = ({ value, onChange }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [local, setLocal] = useState(value);

  const handleClose = () => {
    setAnchor(null);
    if (local !== value) onChange(local);
  };

  return (
    <>
      <Box
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{
          width: 28,
          height: 28,
          border: `1px solid ${COLORS.lightGray}`,
          borderRadius: "4px",
          backgroundColor: local,
          cursor: "pointer",
          flexShrink: 0,
        }}
      />
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Sketch
          color={local}
          presetColors={Object.values(COLORS)}
          onChange={(c) => {
            const { r, g, b, a } = c.rgba;
            const s = `rgba(${r}, ${g}, ${b}, ${a})`;
            setLocal(s);
          }}
        />
      </Popover>
    </>
  );
};

export default ColorSwatch;
