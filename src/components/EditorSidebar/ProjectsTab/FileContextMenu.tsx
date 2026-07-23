// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import * as React from "react";
import Paper from "@mui/material/Paper";
import MenuList from "@mui/material/MenuList";
import MenuItem from "@mui/material/MenuItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemIcon from "@mui/material/ListItemIcon";
import { FRONT_UI_ZIDX } from "@src/constants/constants";
import NoteAddOutlined from "@mui/icons-material/NoteAddOutlined";
import CreateNewFolderOutlined from "@mui/icons-material/CreateNewFolderOutlined";
import DriveFileRenameOutlineOutlined from "@mui/icons-material/DriveFileRenameOutlineOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import RestoreIcon from "@mui/icons-material/Restore";

export interface FileContextMenuProps {
  visible: boolean;
  mousePos: { x: number; y: number };
  onClose: () => void;
  isDirectory: boolean;
  isDirty: boolean;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
  onRevert: () => void;
}

const FileContextMenu: React.FC<FileContextMenuProps> = ({
  visible,
  mousePos,
  onClose,
  isDirectory,
  isDirty,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
  onRevert,
}) => {
  if (!visible) return null;

  const options = [
    {
      label: "New file",
      icon: <NoteAddOutlined fontSize="small" />,
      action: onNewFile,
      disabled: false,
    },
    {
      label: "New folder",
      icon: <CreateNewFolderOutlined fontSize="small" />,
      action: onNewFolder,
      disabled: false,
    },
    { divider: true },
    {
      label: "Rename",
      icon: <DriveFileRenameOutlineOutlined fontSize="small" />,
      action: onRename,
      disabled: false,
    },
    { divider: true },
    {
      label: "Delete",
      icon: <DeleteOutlined fontSize="small" />,
      action: onDelete,
      disabled: false,
    },
    { divider: true },
    {
      label: isDirectory ? "Revert directory changes" : "Revert file changes",
      icon: <RestoreIcon fontSize="small" />,
      action: onRevert,
      disabled: !isDirty,
    },
  ];

  const nDividers = options.filter((opt) => opt.divider).length;
  const menuWidth = 220;
  const padding = 8;
  const estimatedHeight = (options.length - nDividers) * 32 + nDividers * 8 + padding * 2;

  let adjustedX = mousePos.x;
  let adjustedY = mousePos.y;

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
            </MenuItem>
          ),
        )}
      </MenuList>
    </Paper>
  );
};

export default FileContextMenu;
