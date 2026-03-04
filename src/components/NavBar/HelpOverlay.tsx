// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useState, useRef } from "react";
import { IconButton, Fade, Box, Typography, Tooltip, Divider } from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { APP_SRC_URL, FRONT_UI_ZIDX } from "@src/constants/constants";

interface ShortcutRowProps {
  action: string;
  keys: string | string[];
}

const KeyPill: React.FC<{ label: string }> = ({ label }) => (
  <Box
    component="span"
    sx={{
      display: "inline-block",
      px: 1,
      py: 0.2,
      borderRadius: 1,
      bgcolor: "rgba(255,255,255,0.1)",
      border: "1px solid rgba(255,255,255,0.2)",
      fontSize: "0.8rem",
      mx: 0.15,
    }}
  >
    {label}
  </Box>
);

const renderBinding = (binding: string, idx: number) => {
  // Split only on "+" or "or"
  const tokens = binding
    .split(/(\+|or)/i)
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <Box key={idx} component="span" sx={{ display: "inline-flex", alignItems: "center", mx: 1 }}>
      {tokens.map((token, i) =>
        token.toLowerCase() === "or" ? (
          <Typography key={i} variant="body2" component="span" sx={{ mx: 0.5 }}>
            or
          </Typography>
        ) : token === "+" ? (
          <Typography key={i} variant="body2" component="span" sx={{ mx: 0.2 }}>
            +
          </Typography>
        ) : (
          <KeyPill key={i} label={token} />
        ),
      )}
    </Box>
  );
};

const ShortcutRow: React.FC<ShortcutRowProps> = ({ action, keys }) => {
  const bindings = Array.isArray(keys) ? keys : [keys];

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        py: 0.5,
        borderBottom: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <Typography variant="body2">{action}</Typography>
      <Box component="span">
        {bindings.map((binding, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && (
              <Typography variant="body2" component="span" sx={{ mx: 0.5, opacity: 0.8 }}>
                or
              </Typography>
            )}
            {renderBinding(binding, idx)}
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
};

const HelpOverlay: React.FC = () => {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const handleOpen = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };

  const handleCloseWithDelay = () => {
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
    }, 1000);
  };

  return (
    <>
      <Tooltip title="Help / Shortcuts">
        <IconButton
          onMouseEnter={handleOpen}
          onMouseLeave={handleCloseWithDelay}
          sx={{ color: "white" }}
        >
          <HelpOutlineIcon />
        </IconButton>
      </Tooltip>

      <Fade in={open} timeout={300}>
        <Box
          onMouseEnter={handleOpen}
          onMouseLeave={handleCloseWithDelay}
          sx={{
            width: 480,
            height: "auto",
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            bgcolor: "rgba(73, 73, 73, 0.95)",
            color: "white",
            p: 3,
            borderRadius: 2,
            boxShadow: 4,
            textAlign: "left",
            zIndex: FRONT_UI_ZIDX,
          }}
        >
          <Typography variant="h6" gutterBottom textAlign="center">
            Help
          </Typography>
          <Typography variant="body2" gutterBottom>
            Select a widget from the left bar, drag and drop it on the canvas. Edit its properties
            using the right menu. Add PV names as needed. Enter runtime mode when ready. <br />
            <br />
            <i>
              If you find any problems, please create a{" "}
              <a
                href={`${APP_SRC_URL}/issues/new`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "white" }}
              >
                new GitHub issue
                <OpenInNewIcon sx={{ fontSize: 12, ml: 0.5 }} />
              </a>
              .
            </i>
          </Typography>

          <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.2)" }} />

          <Typography variant="h6" gutterBottom>
            Shortcuts
          </Typography>
          <ShortcutRow action="Undo" keys="Ctrl + Z" />
          <ShortcutRow action="Redo" keys="Ctrl + Y" />
          <ShortcutRow action="Copy widget" keys="Ctrl + C" />
          <ShortcutRow action="Paste widget" keys="Ctrl + V" />
          <ShortcutRow action="Delete widget" keys="Delete" />
          <ShortcutRow action="Select all" keys="Ctrl + A" />
          <ShortcutRow action="Group" keys="Ctrl + G" />
          <ShortcutRow action="Ungroup" keys="Ctrl + U" />
          <ShortcutRow action="Export layout" keys="Ctrl + S" />

          <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.2)" }} />

          <Typography variant="h6" gutterBottom>
            Mouse
          </Typography>
          <ShortcutRow action="Center screen" keys={["Middle Mouse", "Ctrl + Shift + C"]} />
          <ShortcutRow action="Zoom" keys="Scroll Wheel" />
          <ShortcutRow action="Pan screen" keys={["Middle Mouse", "Alt + Drag"]} />
        </Box>
      </Fade>
    </>
  );
};

export default HelpOverlay;
