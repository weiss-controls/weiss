// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import React, { useEffect } from "react";
import { Button } from "@mui/material";
import type { WidgetUpdate } from "@src/types/widgets";
import { FLEX_ALIGN_MAP } from "@src/constants/constants";
import { useRepoStore } from "@src/stores/repoStore";
import { useUIStore } from "@src/stores/uiStore";
import { resolveRepoPath } from "@src/utils/repoPath";
import { useEditorStore } from "@src/stores/editorStore";

const NavigationButtonComp: React.FC<WidgetUpdate> = ({ data }) => {
  const selectedFile = useRepoStore((s) => s.selectedFile);
  const { setSelectedFile } = useRepoStore.getState();
  const inEditMode = useUIStore((s) => s.inEditMode);
  const { forwardNavigationMacros } = useEditorStore.getState();
  const p = data.editableProperties;
  const clicked = React.useRef(false);

  const handleClick = () => {
    if (inEditMode) return;
    const navPath = p.displayPath?.value;
    if (!navPath || !selectedFile) return;
    const resolved = resolveRepoPath(navPath, selectedFile.path);
    setSelectedFile({ repo_id: selectedFile.repo_id, path: resolved });
    clicked.current = true;
  };

  useEffect(() => {
    // whenever the selected file changes, check if this button was the cause.
    // If so, forward the current runtime macro context and append this
    // button-provided macros on top.
    if (inEditMode) return;
    if (!selectedFile) return;
    if (!clicked.current) return;
    clicked.current = false;
    forwardNavigationMacros(p.macros?.value ?? {});
    // We intentionally want this effect to run only when the selected file changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile]);

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
        minWidth: 0,
        minHeight: 0,
        padding: 0.5,
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
