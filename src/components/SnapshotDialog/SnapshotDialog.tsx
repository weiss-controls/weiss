// SPDX-License-Identifier: GPL-3.0-or-later
// Snapshot Save/Restore for WEISS
// Contributed by Elmaddin Guliyev 2026/05/18

import { useState, useCallback } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import DeleteIcon from "@mui/icons-material/Delete";
import RestoreIcon from "@mui/icons-material/Restore";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import SaveIcon from "@mui/icons-material/Save";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import type { PVValue } from "@src/types/epicsWS";

interface SnapshotEntry {
  name: string;
  timestamp: string;
  pvs: Record<string, { value: PVValue; alarm?: number; timestamp?: number }>;
  count: number;
}

interface SnapshotDialogProps {
  open: boolean;
  onClose: () => void;
  onTakeSnapshot: () => Promise<Record<string, unknown> | null>;
  onRestore: (pvs: Record<string, { value: PVValue }>) => Promise<Record<string, unknown> | null>;
}

const STORAGE_KEY = "weiss-snapshots";

function loadSnapshots(): SnapshotEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSnapshots(snapshots: SnapshotEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
}

export default function SnapshotDialog({
  open,
  onClose,
  onTakeSnapshot,
  onRestore,
}: SnapshotDialogProps) {
  const [snapshots, setSnapshots] = useState<SnapshotEntry[]>(loadSnapshots);
  const [snapshotName, setSnapshotName] = useState("");
  const [tab, setTab] = useState(0);
  const [status, setStatus] = useState<{ message: string; severity: "success" | "error" | "info" } | null>(null);
  const [compareIdx, setCompareIdx] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSave = useCallback(async () => {
    if (!snapshotName.trim()) {
      setStatus({ message: "Please enter a snapshot name", severity: "error" });
      return;
    }
    setLoading(true);
    setStatus({ message: "Capturing PV values...", severity: "info" });

    try {
      const result = await onTakeSnapshot();
      if (result && "pvs" in result) {
        const pvs = result.pvs as Record<string, { value: PVValue; alarm?: number; timestamp?: number }>;
        const count = (result.count as number) || Object.keys(pvs).length;
        const entry: SnapshotEntry = {
          name: snapshotName.trim(),
          timestamp: new Date().toISOString(),
          pvs,
          count,
        };
        const updated = [entry, ...snapshots];
        setSnapshots(updated);
        saveSnapshots(updated);
        setSnapshotName("");
        setStatus({ message: `Saved "${entry.name}" with ${count} PVs`, severity: "success" });
      } else {
        setStatus({ message: "Snapshot failed — no data returned. Are PVs subscribed in Runtime mode?", severity: "error" });
      }
    } catch (e) {
      setStatus({ message: `Snapshot error: ${e}`, severity: "error" });
    }
    setLoading(false);
  }, [snapshotName, snapshots, onTakeSnapshot]);

  const handleRestore = useCallback(async (idx: number) => {
    const snap = snapshots[idx];
    if (!snap) return;
    setLoading(true);
    setStatus({ message: `Restoring ${snap.count} PVs from "${snap.name}"...`, severity: "info" });

    try {
      const pvData: Record<string, { value: PVValue }> = {};
      for (const [pv, data] of Object.entries(snap.pvs)) {
        pvData[pv] = { value: data.value };
      }
      const result = await onRestore(pvData);
      if (result && "succeeded" in result) {
        setStatus({
          message: `Restored ${result.succeeded}/${result.total} PVs from "${snap.name}"`,
          severity: (result.succeeded as number) === (result.total as number) ? "success" : "error",
        });
      } else {
        setStatus({ message: "Restore failed", severity: "error" });
      }
    } catch (e) {
      setStatus({ message: `Restore error: ${e}`, severity: "error" });
    }
    setLoading(false);
  }, [snapshots, onRestore]);

  const handleDelete = useCallback((idx: number) => {
    const updated = snapshots.filter((_, i) => i !== idx);
    setSnapshots(updated);
    saveSnapshots(updated);
    setStatus({ message: "Snapshot deleted", severity: "info" });
  }, [snapshots]);

  const handleCompare = useCallback((idx: number) => {
    if (compareIdx === null) {
      setCompareIdx([idx, -1]);
      setStatus({ message: "Select a second snapshot to compare", severity: "info" });
    } else if (compareIdx[1] === -1) {
      setCompareIdx([compareIdx[0], idx]);
      setTab(2);
    }
  }, [compareIdx]);

  const cancelCompare = useCallback(() => {
    setCompareIdx(null);
    setStatus(null);
  }, []);

  // Compare two snapshots
  const compareData = compareIdx && compareIdx[1] !== -1 ? (() => {
    const a = snapshots[compareIdx[0]];
    const b = snapshots[compareIdx[1]];
    if (!a || !b) return [];
    const allPVs = new Set([...Object.keys(a.pvs), ...Object.keys(b.pvs)]);
    const diffs: { pv: string; valA: string; valB: string; changed: boolean }[] = [];
    for (const pv of allPVs) {
      const valA = a.pvs[pv]?.value ?? "N/A";
      const valB = b.pvs[pv]?.value ?? "N/A";
      diffs.push({
        pv,
        valA: String(valA),
        valB: String(valB),
        changed: String(valA) !== String(valB),
      });
    }
    return diffs.sort((a, b) => (a.changed === b.changed ? a.pv.localeCompare(b.pv) : a.changed ? -1 : 1));
  })() : [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <CameraAltIcon /> PV Snapshots
      </DialogTitle>
      <DialogContent>
        {status && (
          <Alert severity={status.severity} sx={{ mb: 2 }} onClose={() => setStatus(null)}>
            {status.message}
          </Alert>
        )}

        <Tabs value={tab} onChange={(_, v) => { setTab(v); cancelCompare(); }} sx={{ mb: 2 }}>
          <Tab label="Save" />
          <Tab label={`Saved (${snapshots.length})`} />
          {compareIdx && compareIdx[1] !== -1 && <Tab label="Compare" />}
        </Tabs>

        {/* SAVE TAB */}
        {tab === 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Capture current values of all subscribed PVs. Make sure you are in
              Runtime mode with PVs connected.
            </Typography>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <TextField
                label="Snapshot name"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
                size="small"
                fullWidth
                placeholder="e.g., baseline_config, before_tuning"
              />
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={() => void handleSave()}
                disabled={loading || !snapshotName.trim()}
                sx={{ whiteSpace: "nowrap" }}
              >
                Save
              </Button>
            </Box>
          </Box>
        )}

        {/* SAVED LIST TAB */}
        {tab === 1 && (
          <Box>
            {snapshots.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                No snapshots saved yet. Go to the Save tab to capture one.
              </Typography>
            ) : (
              <List dense>
                {snapshots.map((snap, idx) => (
                  <Box key={`${snap.name}-${snap.timestamp}`}>
                    <ListItem>
                      <ListItemText
                        primary={snap.name}
                        secondary={`${new Date(snap.timestamp).toLocaleString()} · ${snap.count} PVs`}
                      />
                      <ListItemSecondaryAction>
                        <Chip label={`${snap.count} PVs`} size="small" sx={{ mr: 1 }} />
                        <IconButton
                          edge="end"
                          title="Compare"
                          onClick={() => handleCompare(idx)}
                          color={compareIdx?.[0] === idx ? "primary" : "default"}
                        >
                          <CompareArrowsIcon />
                        </IconButton>
                        <IconButton
                          edge="end"
                          title="Restore"
                          onClick={() => void handleRestore(idx)}
                          disabled={loading}
                          color="primary"
                        >
                          <RestoreIcon />
                        </IconButton>
                        <IconButton edge="end" title="Delete" onClick={() => handleDelete(idx)}>
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {idx < snapshots.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            )}
          </Box>
        )}

        {/* COMPARE TAB */}
        {tab === 2 && compareIdx && compareIdx[1] !== -1 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Comparing <strong>{snapshots[compareIdx[0]]?.name}</strong> vs{" "}
              <strong>{snapshots[compareIdx[1]]?.name}</strong>
              {" · "}
              {compareData.filter((d) => d.changed).length} differences
            </Typography>
            <Box sx={{ maxHeight: 400, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #333" }}>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>PV</th>
                    <th style={{ textAlign: "right", padding: "6px 8px" }}>{snapshots[compareIdx[0]]?.name}</th>
                    <th style={{ textAlign: "right", padding: "6px 8px" }}>{snapshots[compareIdx[1]]?.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {compareData.map((row) => (
                    <tr
                      key={row.pv}
                      style={{
                        borderBottom: "1px solid #222",
                        backgroundColor: row.changed ? "rgba(239,68,68,0.08)" : undefined,
                      }}
                    >
                      <td style={{ padding: "4px 8px", fontFamily: "monospace", fontSize: 12 }}>
                        {row.pv}
                      </td>
                      <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "monospace" }}>
                        {row.valA}
                      </td>
                      <td
                        style={{
                          padding: "4px 8px",
                          textAlign: "right",
                          fontFamily: "monospace",
                          color: row.changed ? "#ef4444" : undefined,
                          fontWeight: row.changed ? 600 : undefined,
                        }}
                      >
                        {row.valB}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
