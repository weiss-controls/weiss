// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React from "react";
import { Button } from "@mui/material";
import type { WidgetUpdate } from "@src/types/widgets";
import { FLEX_ALIGN_MAP } from "@src/constants/constants";
import { useUIContext } from "@src/context/useUIContext";
import { resolveRepoPath } from "@src/utils/repoPath";

const NavigationButtonComp: React.FC<WidgetUpdate> = ({ data }) => {
  const { inEditMode, selectedFile, setSelectedFile } = useUIContext();
  const p = data.editableProperties;

  const handleClick = () => {
    if (inEditMode) return;
    const navPath = p.displayPath?.value;
    if (!navPath || !selectedFile) return;
    const resolved = resolveRepoPath(navPath, selectedFile.path);
    setSelectedFile({ repo_id: selectedFile.repo_id, path: resolved });
  };

  if (!p.visible?.value) return null;

  return (
    <Button
      title={p.tooltip?.value ?? ""}
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: FLEX_ALIGN_MAP[p.textHAlign?.value ?? "left"],
        alignItems: FLEX_ALIGN_MAP[p.textVAlign?.value ?? "middle"],
        backgroundColor: p.backgroundColor?.value,
        fontSize: p.fontSize?.value,
        fontFamily: p.fontFamily?.value,
        fontWeight: p.fontBold?.value ? "bold" : "normal",
        fontStyle: p.fontItalic?.value ? "italic" : "normal",
        textDecoration: p.fontUnderlined?.value ? "underline" : "none",
        color: p.textColor?.value,
        borderRadius: p.borderRadius?.value,
        borderStyle: p.borderStyle?.value,
        borderWidth: p.borderWidth?.value,
        borderColor: p.borderColor?.value,
        textTransform: "none",
        pointerEvents: inEditMode ? "none" : "auto",
        overflow: "hidden",
      }}
      disableElevation
      disableRipple={inEditMode}
      disabled={!!p.disabled?.value}
      variant="contained"
      onClick={handleClick}
    >
      {p.label!.value}
    </Button>
  );
};

export { NavigationButtonComp };
