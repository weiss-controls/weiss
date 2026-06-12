// SPDX-License-Identifier: GPL-3.0-or-later
// Snapshot Save/Restore for WEISS — backend-persisted version
// Contributed by Elmaddin Guliyev

import { useState, useCallback, useEffect } from "react";
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
import VisibilityIcon from "@mui/icons-material/Visibility";
import SaveIcon from "@mui/icons-material/Save";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import { COLORS } from "@src/constants/constants";
import type { PVValue } from "@src/types/epicsWS";
import type { SnapshotEntry } from "@src/services/APIClient/types.gen";
import {
  saveSnapshot,
  listSnapshots,
  getSnapshot,
  deleteSnapshot,
} from "@src/services/APIClient/sdk.gen";

interface SnapshotDialogProps {
  open: boolean;
  onClose: () => void;
  onTakeSnapshot: () => Promise<Record<string, unknown> | null>;
  onRestore: (pvs: Record<string, { value: PVValue }>) => Promise<Record<string, unknown> | null>;
  opiFile: string;
}

export default function SnapshotDialog({
  open,
  onClose,
  onTakeSnapshot,
  onRestore,
  opiFile,
}: SnapshotDialogProps) {
  const [snapshots, setSnapshots] = useState<SnapshotEntry[]>([]);
  const [snapshotName, setSnapshotName] = useState("");
  const [tab, setTab] = useState(0);
  const [status, setStatus] = useState<{
    message: string;
    severity: "success" | "error" | "info";
  } | null>(null);
  const [compareIdx, setCompareIdx] = useState<[number, number] | null>(null);
  const [compareData, setCompareData] = useState<
    { pv: string; valA: string; valB: string; changed: boolean }[]
  >([]);
  const [viewData, setViewData] = useState<{
    name: string;
    pvs: { pv: string; value: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // Load snapshots from backend when dialog opens or opiFile changes
  const fetchSnapshots = useCallback(async () => {
    if (!opiFile) return;
    try {
      const { data } = await listSnapshots({
        query: { opi_file: opiFile },
        throwOnError: false,
      });
      if (data) {
        setSnapshots(data);
      }
    } catch (e) {
      console.error("Failed to fetch snapshots:", e);
    }
  }, [opiFile]);

  useEffect(() => {
    if (open) {
      void fetchSnapshots();
    }
  }, [open, fetchSnapshots]);

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
        const pvs = result.pvs as Record<string, unknown>;

        const { data } = await saveSnapshot({
          body: {
            name: snapshotName.trim(),
            opi_file: opiFile,
            pvs: pvs as Record<string, { value: unknown }>,
          },
          throwOnError: false,
        });

        if (data) {
          setSnapshotName("");
          setStatus({
            message: `Saved "${data.name}" with ${String(data.pv_count)} PVs`,
            severity: "success",
          });
          void fetchSnapshots();
        } else {
          setStatus({ message: "Failed to save snapshot to server.", severity: "error" });
        }
      } else {
        setStatus({
          message: "Snapshot failed — no data returned. Please, check PV names and try again.",
          severity: "error",
        });
      }
    } catch (e) {
      setStatus({ message: `Snapshot error: ${String(e)}`, severity: "error" });
    }
    setLoading(false);
  }, [snapshotName, opiFile, onTakeSnapshot, fetchSnapshots]);

  const handleRestore = useCallback(
    async (idx: number) => {
      const snap = snapshots[idx];
      if (!snap) return;
      setLoading(true);
      setStatus({
        message: `Restoring PVs from "${snap.name}"...`,
        severity: "info",
      });

      try {
        const { data: detail } = await getSnapshot({
          path: { snapshot_id: snap.id },
          query: { opi_file: opiFile },
          throwOnError: false,
        });

        if (!detail) {
          setStatus({ message: "Failed to load snapshot from server.", severity: "error" });
          setLoading(false);
          return;
        }

        const pvData: Record<string, { value: PVValue }> = {};
        for (const [pv, d] of Object.entries(detail.pvs)) {
          pvData[pv] = { value: d.value as PVValue };
        }
        const restoreResult = await onRestore(pvData);
        if (restoreResult && "succeeded" in restoreResult) {
          const succeeded = Number(restoreResult.succeeded);
          const total = Number(restoreResult.total);
          setStatus({
            message: `Restored ${String(succeeded)}/${String(total)} PVs from "${snap.name}"`,
            severity: succeeded === total ? "success" : "error",
          });
        } else {
          setStatus({ message: "Restore failed", severity: "error" });
        }
      } catch (e) {
        setStatus({ message: `Restore error: ${String(e)}`, severity: "error" });
      }
      setLoading(false);
    },
    [snapshots, opiFile, onRestore],
  );

  const handleDelete = useCallback(
    async (idx: number) => {
      const snap = snapshots[idx];
      if (!snap) return;
      try {
        await deleteSnapshot({
          path: { snapshot_id: snap.id },
          query: { opi_file: opiFile },
          throwOnError: false,
        });
        setStatus({ message: "Snapshot deleted", severity: "info" });
        void fetchSnapshots();
      } catch (e) {
        setStatus({ message: `Delete error: ${String(e)}`, severity: "error" });
      }
    },
    [snapshots, opiFile, fetchSnapshots],
  );

  const handleCompare = useCallback(
    async (idx: number) => {
      if (compareIdx === null) {
        setCompareIdx([idx, -1]);
        setStatus({
          message: "Select a second snapshot to compare",
          severity: "info",
        });
      } else if (compareIdx[1] === -1) {
        setCompareIdx([compareIdx[0], idx]);
        const snapA = snapshots[compareIdx[0]];
        const snapB = snapshots[idx];
        if (!snapA || !snapB) return;
        try {
          const [resA, resB] = await Promise.all([
            getSnapshot({
              path: { snapshot_id: snapA.id },
              query: { opi_file: opiFile },
              throwOnError: false,
            }),
            getSnapshot({
              path: { snapshot_id: snapB.id },
              query: { opi_file: opiFile },
              throwOnError: false,
            }),
          ]);
          if (resA.data && resB.data) {
            const allPVs = new Set([...Object.keys(resA.data.pvs), ...Object.keys(resB.data.pvs)]);
            const diffs: {
              pv: string;
              valA: string;
              valB: string;
              changed: boolean;
            }[] = [];
            for (const pv of allPVs) {
              const valA = JSON.stringify(resA.data.pvs[pv]?.value ?? "N/A");
              const valB = JSON.stringify(resB.data.pvs[pv]?.value ?? "N/A");
              diffs.push({
                pv,
                valA,
                valB,
                changed: valA !== valB,
              });
            }
            setCompareData(
              diffs.sort((a, b) =>
                a.changed === b.changed ? a.pv.localeCompare(b.pv) : a.changed ? -1 : 1,
              ),
            );
            setTab(2);
            setStatus(null);
          }
        } catch (e) {
          setStatus({ message: `Compare error: ${String(e)}`, severity: "error" });
        }
      }
    },
    [compareIdx, snapshots, opiFile],
  );
  const handleView = useCallback(
    async (idx: number) => {
      const snap = snapshots[idx];
      if (!snap) return;
      try {
        const { data: detail } = await getSnapshot({
          path: { snapshot_id: snap.id },
          query: { opi_file: opiFile },
          throwOnError: false,
        });
        if (detail) {
          const pvs = Object.entries(detail.pvs).map(([pv, d]) => ({
            pv,
            value: JSON.stringify(d.value),
          }));
          setViewData({ name: snap.name, pvs });
          setTab(3);
        }
      } catch (e) {
        setStatus({ message: `View error: ${String(e)}`, severity: "error" });
      }
    },
    [snapshots, opiFile],
  );
  const cancelCompare = useCallback(() => {
    setCompareIdx(null);
    setCompareData([]);
    setViewData(null);
    setStatus(null);
  }, []);
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

        <Tabs
          value={tab}
          onChange={(_, v: number) => {
            setTab(v);
            cancelCompare();
          }}
          sx={{ mb: 2 }}
        >
          <Tab label="Save" />
          <Tab label={`Saved (${String(snapshots.length)})`} />
          {compareIdx && compareIdx[1] !== -1 && <Tab label="Compare" />}
          {viewData && <Tab label="View" />}
        </Tabs>

        {/* SAVE TAB */}
        {tab === 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Capture current values of all subscribed PVs.
            </Typography>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <TextField
                label="Snapshot name"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSave();
                }}
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
                  <Box key={snap.id}>
                    <ListItem>
                      <ListItemText
                        primary={snap.name}
                        secondary={`${new Date(snap.timestamp).toLocaleString()} \u00b7 ${String(snap.pv_count)} PVs`}
                      />
                      <ListItemSecondaryAction>
                        <Chip label={`${String(snap.pv_count)} PVs`} size="small" sx={{ mr: 1 }} />
                        <IconButton edge="end" title="View" onClick={() => void handleView(idx)}>
                          <VisibilityIcon />
                        </IconButton>
                        <IconButton
                          edge="end"
                          title="Compare"
                          onClick={() => void handleCompare(idx)}
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
                        <IconButton
                          edge="end"
                          title="Delete"
                          onClick={() => void handleDelete(idx)}
                        >
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
              {" \u00b7 "}
              {compareData.filter((d) => d.changed).length} differences
            </Typography>
            <Box sx={{ maxHeight: 400, overflow: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: `2px solid ${COLORS.gridLineColor}`,
                    }}
                  >
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>PV</th>
                    <th style={{ textAlign: "right", padding: "6px 8px" }}>
                      {snapshots[compareIdx[0]]?.name}
                    </th>
                    <th style={{ textAlign: "right", padding: "6px 8px" }}>
                      {snapshots[compareIdx[1]]?.name}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {compareData.map((row) => (
                    <tr
                      key={row.pv}
                      style={{
                        borderBottom: `1px solid ${COLORS.gridLineColor}`,
                        backgroundColor: row.changed ? `${COLORS.major}14` : undefined,
                      }}
                    >
                      <td
                        style={{
                          padding: "4px 8px",
                          fontFamily: "monospace",
                          fontSize: 12,
                        }}
                      >
                        {row.pv}
                      </td>
                      <td
                        style={{
                          padding: "4px 8px",
                          textAlign: "right",
                          fontFamily: "monospace",
                        }}
                      >
                        {row.valA}
                      </td>
                      <td
                        style={{
                          padding: "4px 8px",
                          textAlign: "right",
                          fontFamily: "monospace",
                          color: row.changed ? COLORS.major : undefined,
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
        {/* VIEW TAB */}
        {tab === 3 && viewData && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Snapshot: <strong>{viewData.name}</strong>
              {" \u00b7 "}
              {viewData.pvs.length} PVs
            </Typography>
            <Box sx={{ maxHeight: 400, overflow: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: `2px solid ${COLORS.gridLineColor}`,
                    }}
                  >
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>PV Name</th>
                    <th style={{ textAlign: "right", padding: "6px 8px" }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {viewData.pvs.map((row) => (
                    <tr
                      key={row.pv}
                      style={{
                        borderBottom: `1px solid ${COLORS.gridLineColor}`,
                      }}
                    >
                      <td style={{ padding: "4px 8px", fontFamily: "monospace", fontSize: 12 }}>
                        {row.pv}
                      </td>
                      <td
                        style={{ padding: "4px 8px", textAlign: "right", fontFamily: "monospace" }}
                      >
                        {row.value}
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
