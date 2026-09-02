// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import * as React from "react";
import { WIDGET_CATEGORY_ORDER, WIDGET_SELECTOR_WIDTH } from "@src/constants/constants";
import type { WidgetDefinition } from "@src/types/widgets";
import WidgetRegistry from "@components/WidgetRegistry/WidgetRegistry";
import { styled } from "@mui/material/styles";
import type { Theme, CSSObject } from "@mui/material/styles";
import Box from "@mui/material/Box";
import DrawerBase from "@mui/material/Drawer";
import List from "@mui/material/List";
import Divider from "@mui/material/Divider";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import ListItemIcon from "@mui/material/ListItemIcon";
import IconButton from "@mui/material/IconButton";
import ListSubheader from "@mui/material/ListSubheader";
import WidgetsIcon from "@mui/icons-material/Widgets";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Tooltip from "@mui/material/Tooltip";
import { useWidgetContext } from "@src/context/useWidgetContext";
import { useUIContext } from "@src/context/useUIContext";

const openedMixin = (theme: Theme): CSSObject => ({
  width: WIDGET_SELECTOR_WIDTH,
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: "hidden",
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: "hidden",
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up("sm")]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
}));

const Drawer = styled(DrawerBase, { shouldForwardProp: (prop) => prop !== "open" })<{
  open: boolean;
}>(({ theme, open }) => ({
  width: WIDGET_SELECTOR_WIDTH,
  flexShrink: 0,
  whiteSpace: "nowrap",
  boxSizing: "border-box",
  ...(open && {
    ...openedMixin(theme),
    "& .MuiDrawer-paper": openedMixin(theme),
  }),
  ...(!open && {
    ...closedMixin(theme),
    "& .MuiDrawer-paper": closedMixin(theme),
  }),
}));

interface DraggableItemProps {
  item: WidgetDefinition;
  open: boolean;
}

const DraggableItem: React.FC<DraggableItemProps> = ({ item, open }) => {
  const { setPickedWidget, pickedWidget, isPlacementMode, setIsPlacementMode } = useWidgetContext();

  const isActive = isPlacementMode && pickedWidget?.widgetName === item.widgetName;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData("application/json", JSON.stringify(item));
    e.dataTransfer.effectAllowed = "copy";
    const img = new Image();
    img.src = "";
    e.dataTransfer.setDragImage(img, 0, 0);
    setPickedWidget(item);
    setIsPlacementMode(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isActive) {
      setPickedWidget(null);
      setIsPlacementMode(false);
    } else {
      setPickedWidget(item);
      setIsPlacementMode(true);
    }
  };

  return (
    <ListItem disablePadding sx={{ display: "block" }}>
      <Tooltip title={item.widgetLabel} placement="right">
        <ListItemButton
          draggable
          selected={isActive}
          onDragStart={handleDragStart}
          onClick={handleClick}
          sx={{ minHeight: 25, justifyContent: open ? "initial" : "center" }}
        >
          <ListItemIcon
            sx={{
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mr: open ? 2 : 0,
              height: 25,
            }}
          >
            {item.widgetIcon ? <item.widgetIcon /> : <WidgetsIcon />}
          </ListItemIcon>
          {open && <ListItemText primary={item.widgetLabel} sx={{ height: 20 }} />}
        </ListItemButton>
      </Tooltip>
    </ListItem>
  );
};

/**
 * WidgetPicker renders the sidebar containing all available widgets for the editor.
 */
const WidgetPicker: React.FC = () => {
  const { inEditMode, wdgPickerOpen, setWdgPickerOpen } = useUIContext();
  const palette: Record<string, WidgetDefinition> = React.useMemo(
    () =>
      Object.fromEntries(Object.values(WidgetRegistry).map((w) => [w.widgetName, w])) as Record<
        string,
        WidgetDefinition
      >,
    [],
  );

  const categories = React.useMemo(() => {
    const grouped: Record<string, WidgetDefinition[]> = {};
    for (const entry of Object.values(palette)) {
      const category = entry.category || "Uncategorized";
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(entry);
    }

    // Order categories per WIDGET_CATEGORY_ORDER; unlisted ones are placed last.
    const ordered: Record<string, WidgetDefinition[]> = {};
    for (const category of WIDGET_CATEGORY_ORDER) {
      if (grouped[category]) ordered[category] = grouped[category];
    }
    for (const [category, entries] of Object.entries(grouped)) {
      if (!ordered[category]) ordered[category] = entries;
    }
    return ordered;
  }, [palette]);
  if (!inEditMode) return;
  return (
    <Box sx={{ display: "flex" }}>
      <Drawer variant="permanent" open={wdgPickerOpen} onClick={(e) => e.stopPropagation()}>
        <DrawerHeader>
          <IconButton onClick={() => setWdgPickerOpen((o) => !o)}>
            {wdgPickerOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </IconButton>
        </DrawerHeader>

        <List disablePadding>
          {Object.entries(categories).map(([category, items], index) => (
            <React.Fragment key={category}>
              {wdgPickerOpen && (
                <ListSubheader component="div" sx={{ px: 2, lineHeight: "32px" }}>
                  {category}
                </ListSubheader>
              )}
              {items.map((item) => (
                <DraggableItem key={item.widgetName} item={item} open={wdgPickerOpen} />
              ))}
              {index < Object.keys(categories).length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      </Drawer>
    </Box>
  );
};

export default WidgetPicker;
