// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Box from "@mui/material/Box";
import AlignVerticalTop from "@mui/icons-material/AlignVerticalTop";
import Undo from "@mui/icons-material/Undo";
import Redo from "@mui/icons-material/Redo";
import AlignVerticalBottom from "@mui/icons-material/AlignVerticalBottom";
import AlignHorizontalLeft from "@mui/icons-material/AlignHorizontalLeft";
import AlignHorizontalRight from "@mui/icons-material/AlignHorizontalRight";
import FlipToFront from "@mui/icons-material/FlipToFront";
import FlipToBack from "@mui/icons-material/FlipToBack";
import AlignVerticalCenter from "@mui/icons-material/AlignVerticalCenter";
import AlignHorizontalCenter from "@mui/icons-material/AlignHorizontalCenter";
import DragIndicator from "@mui/icons-material/DragIndicator";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CustomGroupIcon from "@components/CustomIcons/GroupIcon";
import CustomUngroupIcon from "@components/CustomIcons/UngroupIcon";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUp from "@mui/icons-material/KeyboardArrowUp";
import FormatLineSpacingIcon from "@mui/icons-material/FormatLineSpacing";
import ExpandIcon from "@mui/icons-material/Expand";
import { Rnd } from "react-rnd";
import { grey } from "@mui/material/colors";
import "./Toolbar.css";
import { useWidgetContext } from "@src/context/useWidgetContext";
import { useUIContext } from "@src/context/useUIContext";

const ToolbarButtons: React.FC = () => {
  const { inEditMode } = useUIContext();
  const {
    selectedWidgetIDs,
    selectedWidgets,
    handleUndo,
    undoStack,
    handleRedo,
    redoStack,
    bringToFront,
    sendToBack,
    alignTop,
    alignBottom,
    alignHorizontalCenter,
    alignLeft,
    alignRight,
    alignVerticalCenter,
    distributeHorizontal,
    distributeVertical,
    matchWidth,
    matchHeight,
    deleteWidget,
    groupSelected,
    ungroupSelected,
    stepForward,
    stepBackwards,
  } = useWidgetContext();

  if (!inEditMode) return null;

  const noneSelected = selectedWidgetIDs.length === 0;
  const lessThanTwoSelected = selectedWidgetIDs.length < 2;
  const lessThanThreeSelected = selectedWidgetIDs.length < 3;
  const hasGroupSelected = selectedWidgets.some((w) => w.widgetName === "Group");
  const nothingToRedo = redoStack.length === 0;
  const nothingToUndo = undoStack.length === 0;

  const iconSx = {
    color: grey[600],
    "&.Mui-disabled": {
      color: grey[300],
    },
  };

  return (
    <Rnd
      className="toolBar"
      default={{ x: 80, y: 15, width: 620, height: 40 }}
      bounds="window"
      enableResizing={false}
      dragHandleClassName="dragHandle"
    >
      <Box className="toolbarBox" onClick={(e) => e.stopPropagation()}>
        <Box
          className="dragHandle"
          sx={{ cursor: "move", px: 1, display: "flex", alignItems: "center" }}
        >
          <DragIndicator fontSize="small" />
        </Box>

        <Tooltip title="Undo">
          <span>
            <IconButton size="small" onClick={handleUndo} disabled={nothingToUndo} sx={iconSx}>
              <Undo fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Redo">
          <span>
            <IconButton size="small" onClick={handleRedo} disabled={nothingToRedo} sx={iconSx}>
              <Redo fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Bring to front">
          <span>
            <IconButton size="small" onClick={bringToFront} disabled={noneSelected} sx={iconSx}>
              <FlipToFront fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Send to back">
          <span>
            <IconButton size="small" onClick={sendToBack} disabled={noneSelected} sx={iconSx}>
              <FlipToBack fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Step Forward">
          <span>
            <IconButton size="small" onClick={stepForward} disabled={noneSelected} sx={iconSx}>
              <KeyboardArrowUp fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Step Back">
          <span>
            <IconButton size="small" onClick={stepBackwards} disabled={noneSelected} sx={iconSx}>
              <KeyboardArrowDown fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Group widgets">
          <span>
            <IconButton
              size="small"
              onClick={groupSelected}
              disabled={lessThanTwoSelected}
              sx={iconSx}
            >
              <CustomGroupIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Ungroup widgets">
          <span>
            <IconButton
              size="small"
              onClick={ungroupSelected}
              disabled={!hasGroupSelected}
              sx={iconSx}
            >
              <CustomUngroupIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Align left">
          <span>
            <IconButton size="small" onClick={alignLeft} disabled={lessThanTwoSelected} sx={iconSx}>
              <AlignHorizontalLeft fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Align right">
          <span>
            <IconButton
              size="small"
              onClick={alignRight}
              disabled={lessThanTwoSelected}
              sx={iconSx}
            >
              <AlignHorizontalRight fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Align top">
          <span>
            <IconButton size="small" onClick={alignTop} disabled={lessThanTwoSelected} sx={iconSx}>
              <AlignVerticalTop fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Align bottom">
          <span>
            <IconButton
              size="small"
              onClick={alignBottom}
              disabled={lessThanTwoSelected}
              sx={iconSx}
            >
              <AlignVerticalBottom fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Align vertical center">
          <span>
            <IconButton
              size="small"
              onClick={alignVerticalCenter}
              disabled={lessThanTwoSelected}
              sx={iconSx}
            >
              <AlignVerticalCenter fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Align horizontal center">
          <span>
            <IconButton
              size="small"
              onClick={alignHorizontalCenter}
              disabled={lessThanTwoSelected}
              sx={iconSx}
            >
              <AlignHorizontalCenter fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Distribute horizontally">
          <span>
            <IconButton
              size="small"
              onClick={distributeHorizontal}
              disabled={lessThanThreeSelected}
              sx={iconSx}
            >
              <FormatLineSpacingIcon fontSize="small" sx={{ transform: "rotate(90deg)" }} />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Distribute vertically">
          <span>
            <IconButton
              size="small"
              onClick={distributeVertical}
              disabled={lessThanThreeSelected}
              sx={iconSx}
            >
              <FormatLineSpacingIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Match width">
          <span>
            <IconButton
              size="small"
              onClick={matchWidth}
              disabled={lessThanTwoSelected}
              sx={iconSx}
            >
              <ExpandIcon fontSize="small" sx={{ transform: "rotate(90deg)" }} />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Match height">
          <span>
            <IconButton
              size="small"
              onClick={matchHeight}
              disabled={lessThanTwoSelected}
              sx={iconSx}
            >
              <ExpandIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Delete widget">
          <span>
            <IconButton size="small" onClick={deleteWidget} disabled={noneSelected} sx={iconSx}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Rnd>
  );
};

export default ToolbarButtons;
