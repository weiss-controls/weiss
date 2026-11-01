// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import type { TreeNode } from "@src/services/APIClient";
import { useRepoStore } from "@src/stores/repoStore";
import { importPhoebusFiles, phoebusImportDest } from "@src/stores/actions";
import { COLORS } from "@src/constants/constants";

const ACCEPTED_EXTENSIONS = [".bob", ".svg", ".png", ".jpg", ".jpeg"];

interface ImportSource {
  /** Path relative to the selected or dropped item, e.g. `pumps/main.bob` */
  relPath: string;
  file: File;
}

function isAccepted(relPath: string): boolean {
  const lower = relPath.toLowerCase();
  return (
    ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext)) &&
    !relPath.split("/").some((segment) => segment.startsWith("."))
  );
}

/** Reads a dropped file, or a dropped folder recursively */
async function readEntry(entry: FileSystemEntry, prefix: string): Promise<ImportSource[]> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    );
    return [{ relPath: prefix + entry.name, file }];
  }
  if (!entry.isDirectory) return [];
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const sources: ImportSource[] = [];
  // readEntries returns the folder content in batches, then an empty list
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (batch.length === 0) return sources;
    for (const child of batch) sources.push(...(await readEntry(child, `${prefix}${entry.name}/`)));
  }
}

function findNode(nodes: TreeNode[], path: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node;
    const found = node.children && findNode(node.children, path);
    if (found) return found;
  }
  return undefined;
}

function collectFilePaths(nodes: TreeNode[], out: Set<string>): Set<string> {
  for (const node of nodes) {
    if (node.type === "file") out.add(node.path);
    else if (node.children) collectFilePaths(node.children, out);
  }
  return out;
}

interface PhoebusImportDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function PhoebusImportDialog({ open, onClose }: PhoebusImportDialogProps) {
  const reposTreeInfo = useRepoStore((s) => s.reposTreeInfo);
  const treeSelection = useRepoStore((s) => s.treeSelection);
  const selectedFile = useRepoStore((s) => s.selectedFile);
  const [sources, setSources] = useState<ImportSource[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);

  // Target: the selected folder, the folder of the selected or open file, or the only repository
  const target = useMemo(() => {
    const selection = treeSelection ?? selectedFile;
    const repo =
      reposTreeInfo?.find((r) => r.id === selection?.repo_id) ??
      (reposTreeInfo?.length === 1 ? reposTreeInfo[0] : undefined);
    if (!repo) return null;
    const path = selection?.repo_id === repo.id ? selection.path : "";
    const node = path ? findNode(repo.tree, path) : undefined;
    const dir = node?.type === "file" ? path.slice(0, Math.max(path.lastIndexOf("/"), 0)) : path;
    return {
      repo,
      dir: node ? dir : "",
      existing: collectFilePaths(repo.tree, new Set()),
    };
  }, [reposTreeInfo, treeSelection, selectedFile]);

  const items = useMemo(
    () =>
      sources
        .map((s) => {
          const dest = phoebusImportDest(target?.dir ?? "", s.relPath);
          return { ...s, dest, exists: !!target?.existing.has(dest) };
        })
        .sort((a, b) => a.dest.localeCompare(b.dest)),
    [sources, target],
  );
  const conflicts = items.filter((i) => i.exists).length;
  const toImport = items.filter((i) => overwrite || !i.exists);
  const displayCount = items.filter((i) => i.dest.endsWith(".opi.json")).length;

  const addSources = (added: ImportSource[]) => {
    const accepted = added.filter((s) => isAccepted(s.relPath));
    if (accepted.length === 0) return;
    setSources((prev) => {
      const byPath = new Map(prev.map((s) => [s.relPath, s]));
      for (const s of accepted) byPath.set(s.relPath, s);
      return [...byPath.values()];
    });
  };

  const pick = (directory: boolean) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ACCEPTED_EXTENSIONS.join(",");
    input.webkitdirectory = directory;
    input.onchange = () => {
      addSources(
        Array.from(input.files ?? [], (file) => ({
          relPath: directory ? file.webkitRelativePath : file.name,
          file,
        })),
      );
    };
    input.click();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    // Entries are only readable during the drop event, so they are collected before any await
    const entries = Array.from(e.dataTransfer.items, (item) => item.webkitGetAsEntry()).filter(
      (entry): entry is FileSystemEntry => entry !== null,
    );
    void Promise.all(entries.map((entry) => readEntry(entry, ""))).then((r) =>
      addSources(r.flat()),
    );
  };

  const handleClose = () => {
    if (importing) return;
    setSources([]);
    setOverwrite(false);
    onClose();
  };

  const handleImport = async () => {
    if (!target) return;
    setImporting(true);
    try {
      await importPhoebusFiles(
        target.repo.id,
        toImport.map(({ file, dest }) => ({ file, dest })),
      );
    } finally {
      setImporting(false);
    }
    setSources([]);
    setOverwrite(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import from CS-Studio/Phoebus</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Alert severity="warning">
            Imported displays may not work out of the box. Validate them before using in production.
          </Alert>
          {target ? (
            <Typography variant="body2">
              Destination: <strong>{target.repo.alias}</strong> / {target.dir || "(root)"}
            </Typography>
          ) : (
            <Alert severity="error">
              Select a destination folder in the project tree before importing.
            </Alert>
          )}
          <Box
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
            }}
            onDrop={handleDrop}
            sx={{
              border: "2px dashed",
              borderColor: dragOver ? COLORS.highlighted : "divider",
              borderRadius: 1,
              p: 3,
              textAlign: "center",
            }}
          >
            <Typography variant="body2" sx={{ mb: 1.5, color: "text.secondary" }}>
              Drop .bob files or folders here, or browse with the buttons below.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ justifyContent: "center" }}>
              <Button variant="outlined" size="small" onClick={() => pick(false)}>
                Select files
              </Button>
              <Button variant="outlined" size="small" onClick={() => pick(true)}>
                Select folder
              </Button>
            </Stack>
          </Box>
          {items.length > 0 && (
            <Box>
              <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {displayCount} display(s), {items.length - displayCount} image(s)
                </Typography>
                <Button size="small" onClick={() => setSources([])} disabled={importing}>
                  Clear
                </Button>
              </Stack>
              <List dense sx={{ maxHeight: 240, overflow: "auto" }}>
                {items.map((item) => (
                  <ListItem
                    key={item.relPath}
                    disableGutters
                    secondaryAction={
                      <IconButton
                        size="small"
                        disabled={importing}
                        onClick={() =>
                          setSources((prev) => prev.filter((s) => s.relPath !== item.relPath))
                        }
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={item.dest}
                      slotProps={{ primary: { variant: "body2", noWrap: true } }}
                    />
                    {item.exists && (
                      <Chip
                        label={overwrite ? "overwrite" : "exists, skipped"}
                        size="small"
                        color={overwrite ? "warning" : "default"}
                        sx={{ mr: 1 }}
                      />
                    )}
                  </ListItem>
                ))}
              </List>
              {conflicts > 0 && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={overwrite}
                      onChange={(e) => setOverwrite(e.target.checked)}
                    />
                  }
                  label={`Overwrite ${conflicts} existing file(s)`}
                />
              )}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={importing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleImport()}
          disabled={!target || toImport.length === 0 || importing}
          startIcon={importing ? <CircularProgress size={16} /> : <FileUploadIcon />}
        >
          Import {toImport.length > 0 ? toImport.length : ""}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
