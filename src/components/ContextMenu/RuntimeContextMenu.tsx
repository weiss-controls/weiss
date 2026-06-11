// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import * as React from "react";
import Paper from "@mui/material/Paper";
import MenuList from "@mui/material/MenuList";
import MenuItem from "@mui/material/MenuItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemIcon from "@mui/material/ListItemIcon";
import Tooltip from "@mui/material/Tooltip";
import { FRONT_UI_ZIDX } from "@src/constants/constants";
import type { GridPosition } from "@src/types/widgets";
import type { PVData } from "@src/types/epicsWS";

import ContentCopy from "@mui/icons-material/ContentCopy";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import HistoryIcon from "@mui/icons-material/History";
import { notifyUser } from "@src/services/Notifications/Notification";

export interface RuntimeContextMenuProps {
  pos: GridPosition;
  visible: boolean;
  onClose: () => void;
  pvName: string | null;
  pvData: PVData | null;
}

const RuntimeContextMenu: React.FC<RuntimeContextMenuProps> = ({
  pos,
  visible,
  onClose,
  pvName,
  pvData,
}) => {
  if (!visible) return null;

  const hasPV = pvName !== null && pvName !== "";
  const hasValue = hasPV && pvData !== null;

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard
      .writeText(text)
      .then(() => {
        notifyUser("Copied to clipboard", "success");
      })
      .catch(() => {
        notifyUser("Failed to copy", "error");
      });
    onClose();
  };

  const formatValue = (data: PVData): string => String(data.value);
  const formatTimestamp = (data: PVData): string => {
    const seconds = data.timeStamp.secondsPastEpoch + data.timeStamp.nanoseconds / 1e9;
    return new Date(seconds * 1000).toLocaleString("sv");
  };

  const menuWidth = 240;
  const padding = 8;
  // 3 active items + 1 divider + 2 disabled items
  const estimatedHeight = 5 * 32 + 1 * 8 + padding * 2;

  let adjustedX = pos.x;
  let adjustedY = pos.y;

  if (adjustedX + menuWidth > window.innerWidth - padding) {
    adjustedX = Math.max(padding, window.innerWidth - menuWidth - padding);
  }

  if (adjustedY + estimatedHeight > window.innerHeight - padding) {
    adjustedY = Math.max(padding, window.innerHeight - estimatedHeight - padding);
  }

  return (
    <Paper
      className="contextMenu"
      sx={{
        position: "fixed",
        left: adjustedX,
        top: adjustedY,
        zIndex: FRONT_UI_ZIDX,
        width: menuWidth,
        maxWidth: "100%",
        boxShadow: 3,
      }}
      onMouseUp={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
    >
      <MenuList dense sx={{ zIndex: FRONT_UI_ZIDX }}>
        <MenuItem
          disabled={!hasPV}
          onClick={(e) => {
            e.stopPropagation();
            if (hasPV) {
              void copyToClipboard(pvName);
            }
          }}
        >
          <ListItemIcon>
            <ContentCopy fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy PV Name</ListItemText>
        </MenuItem>

        <MenuItem
          disabled={!hasValue}
          onClick={(e) => {
            e.stopPropagation();
            if (hasValue) {
              void copyToClipboard(formatValue(pvData));
            }
          }}
        >
          <ListItemIcon>
            <ContentCopy fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy PV Value</ListItemText>
        </MenuItem>

        <MenuItem
          disabled={!hasValue}
          onClick={(e) => {
            e.stopPropagation();
            if (hasValue) {
              void copyToClipboard(`${formatTimestamp(pvData)} ${pvName} ${formatValue(pvData)}`);
            }
          }}
        >
          <ListItemIcon>
            <ContentCopy fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy PV Name with Value</ListItemText>
        </MenuItem>

        <hr style={{ margin: "4px 0", border: "0.5px solid #eee" }} />

        <Tooltip title="Coming soon" placement="right">
          <span>
            <MenuItem disabled>
              <ListItemIcon>
                <InfoOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>PV Details</ListItemText>
            </MenuItem>
          </span>
        </Tooltip>

        <Tooltip title="Coming soon" placement="right">
          <span>
            <MenuItem disabled>
              <ListItemIcon>
                <HistoryIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>See PV History</ListItemText>
            </MenuItem>
          </span>
        </Tooltip>
      </MenuList>
    </Paper>
  );
};

export default RuntimeContextMenu;
