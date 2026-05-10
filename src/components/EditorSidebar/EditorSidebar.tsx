// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useEffect, useRef, useState } from "react";
import { styled } from "@mui/material/styles";
import {
  Divider,
  Drawer as MuiDrawer,
  Tab,
  Tabs,
  Toolbar,
  ListItem,
  ListItemText,
  IconButton,
  Tooltip,
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import ModeEditIcon from "@mui/icons-material/ModeEdit";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import { COLORS, FRONT_UI_ZIDX } from "@src/constants/constants";
import PropertyNavigator from "./PropertiesTab/PropertiesTab";
import ProjectsTab from "./ProjectsTab/ProjectsTab";
import WidgetTree from "@components/WidgetTree";
import { useUIContext } from "@src/context/useUIContext";
import { useWidgetContext } from "@src/context/useWidgetContext";
import WidgetRegistry from "@components/WidgetRegistry/WidgetRegistry";

const Drawer = styled(MuiDrawer)(({ theme }) => ({
  "& .MuiDrawer-paper": {
    right: 0,
    height: "100vh",
    overflowX: "hidden",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
}));

const ToggleButton = styled(IconButton)<{
  open: boolean;
  drawerWidth: number;
}>(({ theme, open, drawerWidth }) => ({
  position: "fixed",
  top: (theme.mixins.toolbar.minHeight as number) + 16,
  right: open ? drawerWidth + 8 : 8,
  zIndex: theme.zIndex.drawer + 2,
  background: theme.palette.background.paper,
  boxShadow: theme.shadows[2],
  "&:hover": {
    background: theme.palette.background.default,
  },
}));

const ResizeHandle = styled("div")({
  position: "absolute",
  width: 10,
  height: "100%",
  cursor: "col-resize",
  zIndex: FRONT_UI_ZIDX,
});

const EditorTab = {
  EDIT: 0,
  LAYERS: 1,
  NAVIGATE: 2,
} as const;
type EditorTab = (typeof EditorTab)[keyof typeof EditorTab];

const EditorSidebar: React.FC = () => {
  const { selectedWidgetIDs, editingWidgets } = useWidgetContext();
  const { inEditMode, isAuthenticated } = useUIContext();
  const DEFAULT_WIDTH = 360;
  const MIN_WIDTH = 300;
  const MAX_WIDTH = 700;

  const isSmallScreen = window.innerWidth < 1024;

  const [open, setOpen] = useState(!isSmallScreen);
  const [pinned, setPinned] = useState(!isSmallScreen);
  const [drawerWidth, setDrawerWidth] = useState(DEFAULT_WIDTH);
  const [tabIndex, setTabIndex] = useState<EditorTab>(EditorTab.NAVIGATE);

  const paperRef = useRef<HTMLDivElement | null>(null);
  const widthRef = useRef(drawerWidth);

  useEffect(() => {
    widthRef.current = drawerWidth;
  }, [drawerWidth]);

  useEffect(() => {
    if (isAuthenticated && !inEditMode) {
      setTabIndex(EditorTab.NAVIGATE);
    }
  }, [isAuthenticated, inEditMode]);

  useEffect(() => {
    if (selectedWidgetIDs.length > 0) {
      setTabIndex((prev) => (prev === EditorTab.LAYERS ? EditorTab.LAYERS : EditorTab.EDIT));
      setOpen(true);
    } else if (!pinned) {
      setOpen(false);
    }
  }, [selectedWidgetIDs.length, pinned]);

  const toggleDrawer = () => setOpen((prev) => !prev);
  const togglePin = () => setPinned((prev) => !prev);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();

    const startX = e.clientX;
    const startWidth = widthRef.current;
    const paper = paperRef.current;
    const handle = e.currentTarget as HTMLDivElement;

    if (!paper || !handle) return;

    paper.style.transition = "none";

    const movingHandle = handle.cloneNode(true) as HTMLDivElement;
    movingHandle.style.position = "fixed";
    movingHandle.style.top = `${handle.getBoundingClientRect().top}px`;
    movingHandle.style.left = `${handle.getBoundingClientRect().left}px`;
    movingHandle.style.width = "50px";
    movingHandle.style.zIndex = `${2 * FRONT_UI_ZIDX}`;
    movingHandle.style.cursor = "col-resize";

    document.body.appendChild(movingHandle);

    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));

      widthRef.current = newWidth;
      paper.style.width = `${newWidth}px`;
      movingHandle.style.left = `${ev.clientX - 30}px`;
    };

    const onUp = () => {
      paper.style.transition = "";
      document.body.removeChild(movingHandle);
      setDrawerWidth(widthRef.current);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  if (!inEditMode && !isAuthenticated) return null;

  const header =
    tabIndex === EditorTab.EDIT
      ? editingWidgets.length === 1
        ? `${WidgetRegistry[editingWidgets[0].widgetName]?.widgetLabel ?? editingWidgets[0].widgetName} properties`
        : "Common properties in selection"
      : tabIndex === EditorTab.LAYERS
        ? "Widget layers"
        : "Browse projects";

  return (
    <>
      {!open && (
        <Tooltip title="Show properties" placement="left">
          <ToggleButton
            color="primary"
            open={open}
            drawerWidth={drawerWidth}
            onClick={toggleDrawer}
            size="small"
          >
            <ChevronLeftIcon />
          </ToggleButton>
        </Tooltip>
      )}

      <Drawer
        open={open}
        variant="permanent"
        anchor="right"
        sx={{ zIndex: FRONT_UI_ZIDX + 1 }}
        slotProps={{
          paper: {
            ref: paperRef,
            style: {
              width: open ? drawerWidth : 0,
              display: "flex",
              flexDirection: "column",
            },
          },
        }}
      >
        <ResizeHandle onMouseDown={startResize} />
        <Toolbar />

        {/* Header */}
        <ListItem
          sx={{ width: "100%", flex: "0 0 auto", height: 60 }}
          secondaryAction={
            <>
              <Tooltip title={pinned ? "Unpin" : "Pin"}>
                <IconButton edge="end" onClick={togglePin} size="small">
                  {pinned ? <PushPinIcon /> : <PushPinOutlinedIcon />}
                </IconButton>
              </Tooltip>

              <IconButton
                edge="end"
                onClick={toggleDrawer}
                size="small"
                sx={{ display: pinned ? "none" : "auto" }}
              >
                <ChevronRightIcon />
              </IconButton>
            </>
          }
        >
          <ListItemText primary={header} />
        </ListItem>

        <Divider />

        {/* Content */}
        <div style={{ flex: "1 1 auto", overflowY: "auto" }}>
          {tabIndex === EditorTab.EDIT ? (
            <PropertyNavigator />
          ) : tabIndex === EditorTab.LAYERS ? (
            <WidgetTree />
          ) : (
            <ProjectsTab />
          )}
        </div>

        {/* Tabs */}
        {isAuthenticated && inEditMode && (
          <Tabs
            value={tabIndex}
            onChange={(_e, newVal: EditorTab) => setTabIndex(newVal)}
            sx={{
              flex: "0 0 auto",
              borderTop: (theme) => `1px solid ${theme.palette.divider}`,
              width: "100%",
              paddingBottom: 0.1,
              "& .MuiTabs-indicator": { backgroundColor: COLORS.midDarkBlue },
              "& .Mui-selected": { color: `${COLORS.midDarkBlue} !important` },
            }}
          >
            <Tab
              icon={<ModeEditIcon fontSize="small" />}
              iconPosition="start"
              label="Edit"
              sx={{
                textTransform: "none",
                width: "33%",
                minHeight: 0,
                paddingTop: 1.5,
              }}
            />
            <Tab
              icon={<AccountTreeIcon fontSize="small" />}
              iconPosition="start"
              label="Layers"
              sx={{
                textTransform: "none",
                width: "33%",
                minHeight: 0,
                paddingTop: 1.5,
              }}
            />
            <Tab
              icon={<FormatListBulletedIcon fontSize="small" />}
              iconPosition="start"
              label="Navigate"
              sx={{
                textTransform: "none",
                width: "34%",
                minHeight: 0,
                paddingTop: 1.5,
              }}
            />
          </Tabs>
        )}
      </Drawer>
    </>
  );
};

export default EditorSidebar;
