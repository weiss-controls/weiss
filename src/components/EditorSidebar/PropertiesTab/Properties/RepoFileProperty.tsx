// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useMemo, useState } from "react";
import { IconButton, InputAdornment, ListItem, TextField, Tooltip } from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import type { PropertyKey, PropertyValue } from "@src/types/widgets";
import { useUIContext } from "@src/context/useUIContext";
import { toRelativeRepoPath, resolveRepoPath } from "@src/utils/repoPath";
import RepoFileBrowserDialog from "./RepoFileBrowserDialog";

const IMAGE_EXTENSIONS = new Set([".svg", ".png", ".jpg", ".jpeg"]);

interface RepoFilePropertyProps {
  propName: PropertyKey;
  label: string;
  value: PropertyValue;
  category: string;
  /** Allowed file extensions, e.g. [".svg", ".png"]. Accepts all files when empty/undefined. */
  accept?: string[];
  onChange: (propName: PropertyKey, newValue: PropertyValue) => void;
}

const RepoFileProperty: React.FC<RepoFilePropertyProps> = ({
  propName,
  label,
  value,
  accept,
  onChange,
}) => {
  const { selectedFile } = useUIContext();
  const [open, setOpen] = useState(false);

  const opiPath = selectedFile?.path ?? "";

  const selectedAbsPath = useMemo(
    () => (value && typeof value === "string" ? resolveRepoPath(value, opiPath) : undefined),
    [value, opiPath],
  );

  const tooltipTitle = useMemo(() => {
    if (!accept?.length) return "Browse repo files";
    const allImages = accept.every((e) => IMAGE_EXTENSIONS.has(e));
    return allImages ? "Browse repo images" : "Browse repo files";
  }, [accept]);

  const handlePick = (absPath: string) => {
    const relative = opiPath ? toRelativeRepoPath(absPath, opiPath) : `./${absPath}`;
    onChange(propName, relative);
    setOpen(false);
  };

  return (
    <ListItem disablePadding sx={{ px: 2, py: 1, display: "flex", flexBasis: "100%", flexGrow: 1 }}>
      <TextField
        fullWidth
        label={label}
        variant="outlined"
        size="small"
        value={value as string}
        onChange={(e) => onChange(propName, e.target.value)}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title={tooltipTitle}>
                  <span>
                    <IconButton edge="end" size="small" onClick={() => setOpen(true)}>
                      <FolderOpenIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </InputAdornment>
            ),
          },
        }}
      />

      <RepoFileBrowserDialog
        open={open}
        onClose={() => setOpen(false)}
        accept={accept}
        selectedAbsPath={selectedAbsPath}
        onPick={handlePick}
      />
    </ListItem>
  );
};

export default React.memo(RepoFileProperty);
