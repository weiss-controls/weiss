// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  IconButton,
  InputAdornment,
  ListItem,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import type { PropertyKey, PropertyValue, TabEntry } from "@src/types/widgets";
import { useUIContext } from "@src/context/useUIContext";
import { toRelativeRepoPath, resolveRepoPath } from "@src/utils/repoPath";
import RepoFileBrowserDialog from "./RepoFileBrowserDialog";

interface TabListPropertyProps {
  propName: PropertyKey;
  label: string;
  value: PropertyValue;
  category: string;
  onChange: (propName: PropertyKey, newValue: PropertyValue) => void;
}

const DEFAULT_NEW_TAB: TabEntry = { label: "", displayPath: "", macros: {} };

function normalizeTabs(incoming: PropertyValue): TabEntry[] {
  if (!Array.isArray(incoming) || incoming.length === 0) return [{ ...DEFAULT_NEW_TAB }];

  return incoming.map((entry) => {
    const candidate = entry as Partial<TabEntry>;
    return {
      label: String(candidate.label ?? ""),
      displayPath: String(candidate.displayPath ?? ""),
      macros:
        typeof candidate.macros === "object" && candidate.macros !== null ? candidate.macros : {},
    } satisfies TabEntry;
  });
}

type MacroPair = [string, string];

function macrosToPairs(macros: Record<string, string>): MacroPair[] {
  const entries = Object.entries(macros);
  return entries.length > 0 ? entries : [["", ""]];
}

/** Compact key/value macro editor for a single tab row. */
const TabMacrosEditor: React.FC<{
  macros: Record<string, string>;
  onCommit: (macros: Record<string, string>) => void;
}> = ({ macros, onCommit }) => {
  const [localPairs, setLocalPairs] = useState<MacroPair[]>(() => macrosToPairs(macros));

  useEffect(() => {
    setLocalPairs(macrosToPairs(macros));
  }, [macros]);

  const commit = (pairs: MacroPair[]) => {
    const filtered = pairs.filter(([k]) => k.trim() !== "");
    onCommit(Object.fromEntries(filtered));
  };

  const normalizeKey = (key: string) => {
    if (!key.trim()) return key;
    return /^\$\(.+\)$/.test(key) ? key : `$(${key})`;
  };

  const handleKeyCommit = (index: number) => {
    const newPairs = [...localPairs];
    const [key, val] = newPairs[index];
    newPairs[index] = [normalizeKey(key), val];
    setLocalPairs(newPairs);
    commit(newPairs);
  };

  const handleAdd = () => {
    const newPairs = [...localPairs, ["", ""] as MacroPair];
    setLocalPairs(newPairs);
  };

  const handleRemove = (index: number) => {
    const newPairs = localPairs.filter((_, i) => i !== index);
    const ensured = newPairs.length > 0 ? newPairs : [["", ""] as MacroPair];
    setLocalPairs(ensured);
    commit(ensured);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, width: "100%" }}>
      {localPairs.map(([key, val], index) => (
        <Box key={index} sx={{ display: "flex", gap: 0.5 }}>
          <TextField
            size="small"
            label="Macro"
            value={key}
            onChange={(e) => {
              const newPairs = [...localPairs];
              newPairs[index] = [e.target.value, val];
              setLocalPairs(newPairs);
            }}
            onBlur={() => handleKeyCommit(index)}
            sx={{ flex: 1 }}
            slotProps={{ htmlInput: { style: { fontSize: 12 } } }}
          />
          <TextField
            size="small"
            label="Value"
            value={val}
            onChange={(e) => {
              const newPairs = [...localPairs];
              newPairs[index] = [key, e.target.value];
              setLocalPairs(newPairs);
            }}
            onBlur={() => commit(localPairs)}
            sx={{ flex: 1 }}
            slotProps={{ htmlInput: { style: { fontSize: 12 } } }}
          />
          <IconButton size="small" color="primary" onClick={handleAdd}>
            <AddIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleRemove(index)}
            disabled={localPairs.length === 1}
          >
            <RemoveIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
    </Box>
  );
};

const TabListProperty: React.FC<TabListPropertyProps> = ({ propName, label, value, onChange }) => {
  const { selectedFile } = useUIContext();
  const [localTabs, setLocalTabs] = useState<TabEntry[]>(() => normalizeTabs(value));
  const [browseIndex, setBrowseIndex] = useState<number | null>(null);

  useEffect(() => {
    setLocalTabs(normalizeTabs(value));
  }, [value]);

  const opiPath = selectedFile?.path ?? "";

  const commit = (newTabs: TabEntry[]) => {
    onChange(propName, newTabs);
  };

  const handleLabelChange = (index: number, newLabel: string) => {
    const newTabs = localTabs.map((t, i) => (i === index ? { ...t, label: newLabel } : t));
    setLocalTabs(newTabs);
  };

  const handleLabelCommit = () => {
    commit(localTabs);
  };

  const handlePickFile = (absPath: string) => {
    if (browseIndex === null) return;
    const relative = opiPath ? toRelativeRepoPath(absPath, opiPath) : `./${absPath}`;
    const newTabs = localTabs.map((t, i) =>
      i === browseIndex ? { ...t, displayPath: relative } : t,
    );
    setLocalTabs(newTabs);
    commit(newTabs);
    setBrowseIndex(null);
  };

  const handleMacrosCommit = (index: number, macros: Record<string, string>) => {
    const newTabs = localTabs.map((t, i) => (i === index ? { ...t, macros } : t));
    setLocalTabs(newTabs);
    commit(newTabs);
  };

  const handleAdd = (index: number) => {
    const newTabs = [...localTabs];
    newTabs.splice(index + 1, 0, {
      ...DEFAULT_NEW_TAB,
      label: `Tab ${localTabs.length + 1}`,
    });
    setLocalTabs(newTabs);
    commit(newTabs);
  };

  const handleRemove = (index: number) => {
    const newTabs = localTabs.filter((_, i) => i !== index);
    const ensured = newTabs.length > 0 ? newTabs : [{ ...DEFAULT_NEW_TAB }];
    setLocalTabs(ensured);
    commit(ensured);
  };

  const browsingAbsPath = useMemo(() => {
    if (browseIndex === null) return undefined;
    const path = localTabs[browseIndex]?.displayPath;
    return path ? resolveRepoPath(path, opiPath) : undefined;
  }, [browseIndex, localTabs, opiPath]);

  return (
    <>
      <ListItem disablePadding sx={{ px: 2, pt: 1, pb: 0 }}>
        <Typography variant="body2">{label}</Typography>
      </ListItem>

      {localTabs.map((tab, index) => (
        <Box
          key={index}
          sx={{
            mx: 2,
            my: 0.5,
            p: 1,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            display: "flex",
            flexDirection: "row",
            width: "100%",
          }}
        >
          <Box
            sx={{
              mr: 1,
              width: "10%",
              alignItems: "center",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {index + 1}
            </Typography>
          </Box>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
              gap: 0.5,
            }}
          >
            <Box sx={{ display: "flex", width: "100%", alignItems: "center", gap: 0.5 }}>
              <TextField
                size="small"
                label="Tab Label"
                value={tab.label}
                onChange={(e) => handleLabelChange(index, e.target.value)}
                onBlur={handleLabelCommit}
                sx={{ flex: 1 }}
                slotProps={{ htmlInput: { style: { fontSize: 12 } } }}
              />
              <IconButton size="small" color="primary" onClick={() => handleAdd(index)}>
                <AddIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                color="error"
                onClick={() => handleRemove(index)}
                disabled={localTabs.length === 1}
              >
                <RemoveIcon fontSize="small" />
              </IconButton>
            </Box>

            <TextField
              sx={{ width: "100%" }}
              size="small"
              label="Display path"
              value={tab.displayPath}
              onChange={(e) => {
                const newTabs = localTabs.map((t, i) =>
                  i === index ? { ...t, displayPath: e.target.value } : t,
                );
                setLocalTabs(newTabs);
              }}
              onBlur={handleLabelCommit}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Browse repo files">
                        <span>
                          <IconButton edge="end" size="small" onClick={() => setBrowseIndex(index)}>
                            <FolderOpenIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TabMacrosEditor
              macros={tab.macros}
              onCommit={(macros) => handleMacrosCommit(index, macros)}
            />
          </Box>
        </Box>
      ))}

      <RepoFileBrowserDialog
        open={browseIndex !== null}
        onClose={() => setBrowseIndex(null)}
        accept={[".opi.json"]}
        selectedAbsPath={browsingAbsPath}
        onPick={handlePickFile}
      />
    </>
  );
};

export default React.memo(TabListProperty);
