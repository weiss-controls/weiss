// SPDX-License-Identifier: GPL-3.0-or-later
// Alarm summary panel for WEISS
// Contributed by Elmaddin Guliyev

import { useState, useMemo } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorIcon from "@mui/icons-material/Error";
import HelpIcon from "@mui/icons-material/Help";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import { COLORS } from "@src/constants/constants";
import type { PVData } from "@src/types/epicsWS";

const SEVERITY_LABELS: Record<number, string> = {
  0: "NO_ALARM",
  1: "MINOR",
  2: "MAJOR",
  3: "INVALID",
};

const SEVERITY_COLORS: Record<number, string> = {
  0: COLORS.onColor,
  1: COLORS.gitModified,
  2: COLORS.major,
  3: COLORS.invalid,
};

const SEVERITY_ICONS: Record<number, React.ReactNode> = {
  1: <WarningAmberIcon fontSize="small" sx={{ color: COLORS.minor }} />,
  2: <ErrorIcon fontSize="small" sx={{ color: COLORS.major }} />,
  3: <HelpIcon fontSize="small" sx={{ color: COLORS.invalid }} />,
};

interface AlarmPanelProps {
  open: boolean;
  onClose: () => void;
  pvState: Record<string, PVData>;
}

type SeverityFilter = "all" | "minor" | "major" | "invalid";

export default function AlarmPanel({ open, onClose, pvState }: AlarmPanelProps) {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  // Collect all PVs in alarm
  const alarmPVs = useMemo(() => {
    return Object.entries(pvState)
      .filter(([, data]) => data.alarm && data.alarm.severity > 0)
      .map(([pv, data]) => ({
        pv,
        value: data.value,
        severity: data.alarm?.severity ?? 0,
        message: data.alarm?.message ?? "",
        timestamp: data.timeStamp,
        units: data.display?.units ?? "",
        precision: data.display?.precision,
      }))
      .sort((a, b) => b.severity - a.severity || a.pv.localeCompare(b.pv));
  }, [pvState]);

  // Apply filters
  const filteredPVs = useMemo(() => {
    return alarmPVs.filter((item) => {
      const matchSearch = !search || item.pv.toLowerCase().includes(search.toLowerCase());
      const matchSeverity =
        severityFilter === "all" ||
        (severityFilter === "minor" && item.severity === 1) ||
        (severityFilter === "major" && item.severity === 2) ||
        (severityFilter === "invalid" && item.severity === 3);
      return matchSearch && matchSeverity;
    });
  }, [alarmPVs, search, severityFilter]);

  // Counts per severity
  const counts = useMemo(() => {
    const c = { minor: 0, major: 0, invalid: 0 };
    alarmPVs.forEach((item) => {
      if (item.severity === 1) c.minor++;
      else if (item.severity === 2) c.major++;
      else if (item.severity === 3) c.invalid++;
    });
    return c;
  }, [alarmPVs]);

  const formatTimestamp = (ts?: { secondsPastEpoch: number; nanoseconds: number }) => {
    if (!ts?.secondsPastEpoch) return "--";
    const date = new Date(ts.secondsPastEpoch * 1000);
    return date.toLocaleTimeString();
  };

  const formatValue = (value: PVData["value"], units: string, precision?: number) => {
    if (value === undefined || value === null) return "--";
    if (typeof value === "number") {
      const formatted =
        precision !== undefined && precision >= 0 ? value.toFixed(precision) : String(value);
      return `${formatted} ${units}`.trim();
    }
    return `${String(value)} ${units}`.trim();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <NotificationsActiveIcon />
        Alarm Summary
        {alarmPVs.length > 0 ? (
          <Chip
            label={`${String(alarmPVs.length)} active`}
            size="small"
            sx={{
              ml: 1,
              backgroundColor: `${COLORS.major}20`,
              color: COLORS.major,
              fontWeight: 600,
            }}
          />
        ) : (
          <Chip
            label="No alarms"
            size="small"
            sx={{
              ml: 1,
              backgroundColor: `${COLORS.onColor}20`,
              color: COLORS.onColor,
              fontWeight: 600,
            }}
          />
        )}
      </DialogTitle>
      <DialogContent>
        {/* Filter bar */}
        <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center" }}>
          <TextField
            size="small"
            placeholder="Filter by PV name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1 }}
          />
          <ToggleButtonGroup
            size="small"
            value={severityFilter}
            exclusive
            onChange={(_, val: SeverityFilter | null) => {
              if (val) setSeverityFilter(val);
            }}
          >
            <ToggleButton value="all">All ({String(alarmPVs.length)})</ToggleButton>
            <ToggleButton value="minor" sx={{ color: COLORS.minor }}>
              Minor ({String(counts.minor)})
            </ToggleButton>
            <ToggleButton value="major" sx={{ color: COLORS.major }}>
              Major ({String(counts.major)})
            </ToggleButton>
            <ToggleButton value="invalid" sx={{ color: COLORS.invalid }}>
              Invalid ({String(counts.invalid)})
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Alarm list */}
        {filteredPVs.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <CheckCircleIcon sx={{ fontSize: 48, color: COLORS.onColor, mb: 1 }} />
            <Typography color="text.secondary">
              {alarmPVs.length === 0
                ? "No PVs are currently in alarm."
                : "No alarms match the current filter."}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ maxHeight: 400, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${COLORS.gridLineColor}` }}>
                  <th style={{ textAlign: "left", padding: "8px", width: 30 }}></th>
                  <th style={{ textAlign: "left", padding: "8px" }}>PV Name</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Severity</th>
                  <th style={{ textAlign: "right", padding: "8px" }}>Value</th>
                  <th style={{ textAlign: "right", padding: "8px" }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredPVs.map((item) => (
                  <tr
                    key={item.pv}
                    style={{
                      borderBottom: `1px solid ${COLORS.gridLineColor}`,
                      backgroundColor: `${SEVERITY_COLORS[item.severity]}10`,
                    }}
                  >
                    <td style={{ padding: "6px 8px" }}>{SEVERITY_ICONS[item.severity]}</td>
                    <td style={{ padding: "6px 8px", fontFamily: "monospace", fontSize: 12 }}>
                      {item.pv}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <Chip
                        label={SEVERITY_LABELS[item.severity]}
                        size="small"
                        sx={{
                          backgroundColor: `${SEVERITY_COLORS[item.severity]}20`,
                          color: SEVERITY_COLORS[item.severity],
                          fontWeight: 600,
                          fontSize: 11,
                        }}
                      />
                    </td>
                    <td
                      style={{
                        padding: "6px 8px",
                        textAlign: "right",
                        fontFamily: "monospace",
                        fontWeight: 600,
                      }}
                    >
                      {formatValue(item.value, item.units, item.precision)}
                    </td>
                    <td
                      style={{
                        padding: "6px 8px",
                        textAlign: "right",
                        fontFamily: "monospace",
                        fontSize: 11,
                        color: COLORS.midGray,
                      }}
                    >
                      {formatTimestamp(item.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
