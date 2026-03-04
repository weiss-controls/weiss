// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import * as React from "react";
import Paper from "@mui/material/Paper";
import MenuList from "@mui/material/MenuList";
import MenuItem from "@mui/material/MenuItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemIcon from "@mui/material/ListItemIcon";
import Typography from "@mui/material/Typography";
import { FRONT_UI_ZIDX } from "@src/constants/constants";
import type { GridPosition } from "@src/types/widgets";

import AlignVerticalTop from "@mui/icons-material/AlignVerticalTop";
import AlignVerticalBottom from "@mui/icons-material/AlignVerticalBottom";
import AlignHorizontalLeft from "@mui/icons-material/AlignHorizontalLeft";
import AlignHorizontalRight from "@mui/icons-material/AlignHorizontalRight";
import AlignVerticalCenter from "@mui/icons-material/AlignVerticalCenter";
import AlignHorizontalCenter from "@mui/icons-material/AlignHorizontalCenter";
import FlipToFront from "@mui/icons-material/FlipToFront";
import FlipToBack from "@mui/icons-material/FlipToBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CustomGroupIcon from "@components/CustomIcons/GroupIcon";
import CustomUngroupIcon from "@components/CustomIcons/UngroupIcon";
import ContentCopy from "@mui/icons-material/ContentCopy";
import ContentPaste from "@mui/icons-material/ContentPaste";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUp from "@mui/icons-material/KeyboardArrowUp";
import { useUIContext } from "@src/context/useUIContext";
import { useWidgetContext } from "@src/context/useWidgetContext";

export interface ContextMenuProps {
  pos: GridPosition;
  mousePos: GridPosition;
  visible: boolean;
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ pos, mousePos, visible, onClose }) => {
  const { inEditMode } = useUIContext();
  const {
    selectedWidgetIDs,
    bringToFront,
    sendToBack,
    alignTop,
    alignBottom,
    alignLeft,
    alignRight,
    alignVerticalCenter,
    alignHorizontalCenter,
    deleteWidget,
    groupSelected,
    ungroupSelected,
    copyWidget,
    pasteWidget,
    stepForward,
    stepBackwards,
  } = useWidgetContext();

  if (!visible) return null;
  if (!inEditMode) return null; //TODO: add context menu for runtime

  const noneSelected = selectedWidgetIDs.length === 0;
  const lessThanTwoSelected = selectedWidgetIDs.length < 2;

  const options = [
    {
      label: "Copy",
      icon: <ContentCopy fontSize="small" />,
      shortcut: "Ctrl+C",
      action: () => copyWidget(),
      disabled: noneSelected,
    },
    {
      label: "Paste",
      icon: <ContentPaste fontSize="small" />,
      shortcut: "Ctrl+V",
      action: () => pasteWidget(mousePos),
      disabled: false,
    },
    { divider: true },
    {
      label: "Group",
      icon: <CustomGroupIcon fontSize="small" />,
      shortcut: "Ctrl+G",
      action: () => groupSelected(),
      disabled: lessThanTwoSelected,
    },
    {
      label: "Ungroup",
      icon: <CustomUngroupIcon fontSize="small" />,
      shortcut: "Ctrl+U",
      action: () => ungroupSelected(),
      disabled: lessThanTwoSelected,
    },
    { divider: true },
    {
      label: "Align left",
      icon: <AlignHorizontalLeft fontSize="small" />,
      action: () => alignLeft(),
      disabled: lessThanTwoSelected,
    },
    {
      label: "Align right",
      icon: <AlignHorizontalRight fontSize="small" />,
      action: () => alignRight(),
      disabled: lessThanTwoSelected,
    },
    {
      label: "Align top",
      icon: <AlignVerticalTop fontSize="small" />,
      action: () => alignTop(),
      disabled: lessThanTwoSelected,
    },
    {
      label: "Align bottom",
      icon: <AlignVerticalBottom fontSize="small" />,
      action: () => alignBottom(),
      disabled: lessThanTwoSelected,
    },
    {
      label: "Align vert. center",
      icon: <AlignVerticalCenter fontSize="small" />,
      action: () => alignVerticalCenter(),
      disabled: lessThanTwoSelected,
    },
    {
      label: "Align horiz. center",
      icon: <AlignHorizontalCenter fontSize="small" />,
      action: () => alignHorizontalCenter(),
      disabled: lessThanTwoSelected,
    },
    { divider: true },
    {
      label: "Bring to front",
      icon: <FlipToFront fontSize="small" />,
      action: () => bringToFront(),
      disabled: noneSelected,
    },
    {
      label: "Send to back",
      icon: <FlipToBack fontSize="small" />,
      action: () => sendToBack(),
      disabled: noneSelected,
    },
    {
      label: "Step forward",
      icon: <KeyboardArrowUp fontSize="small" />,
      action: () => stepForward(),
      disabled: noneSelected,
    },
    {
      label: "Step back",
      icon: <KeyboardArrowDown fontSize="small" />,
      action: () => stepBackwards(),
      disabled: noneSelected,
    },
    { divider: true },
    {
      label: "Delete",
      icon: <DeleteOutlineIcon fontSize="small" />,
      shortcut: "Del",
      action: () => deleteWidget(),
      disabled: noneSelected,
    },
  ];
  // calculate where to render context menu
  const nDividers = options.filter((opt) => opt.divider).length;
  const menuWidth = 220;
  const padding = 8;
  // Consider 32px per option (default) + 8px per divider + padding
  const estimatedHeight = (options.length - nDividers) * 32 + nDividers * 8 + padding * 2;

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
        {options.map((opt, index) =>
          opt.divider ? (
            <hr key={`divider-${index}`} style={{ margin: "4px 0", border: "0.5px solid #eee" }} />
          ) : (
            <MenuItem
              key={index}
              disabled={opt.disabled}
              onClick={(e) => {
                e.stopPropagation();
                opt.action?.();
                onClose();
              }}
            >
              <ListItemIcon>{opt.icon}</ListItemIcon>
              <ListItemText>{opt.label}</ListItemText>
              {opt.shortcut && (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {opt.shortcut}
                </Typography>
              )}
            </MenuItem>
          ),
        )}
      </MenuList>
    </Paper>
  );
};

export default ContextMenu;
