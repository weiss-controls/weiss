// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import GithubIcon from "@mui/icons-material/GitHub";
import LogoutIcon from "@mui/icons-material/Logout";
import { APP_SRC_URL, COLORS } from "@src/constants/constants";
import { useSessionStore } from "@src/stores/sessionStore";

/** Navigation bar of the archiver viewer; imports nothing from the editor */
export default function ArchiverNavBar() {
  const user = useSessionStore((s) => s.user);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  const handleLogout = () => {
    setUserMenuAnchor(null);
    useSessionStore.getState().logout();
  };

  return (
    <AppBar component="nav" position="fixed" sx={{ backgroundColor: COLORS.titleBarColor }}>
      <Toolbar sx={{ minHeight: 56, px: 2 }}>
        <Tooltip title="Web EPICS Interface & Synoptic Studio">
          <Typography
            noWrap
            component="div"
            sx={{
              fontSize: 22,
              ml: 4,
              mr: 3,
              fontFamily: "monospace",
              fontWeight: 700,
              letterSpacing: ".5rem",
            }}
          >
            WEISS
          </Typography>
        </Tooltip>
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Tooltip title="View source on GitHub">
            <IconButton
              size="small"
              onClick={() => window.open(APP_SRC_URL, "_blank", "noopener,noreferrer")}
            >
              <GithubIcon fontSize="small" sx={{ color: "white" }} />
            </IconButton>
          </Tooltip>
          <IconButton onClick={(e) => setUserMenuAnchor(e.currentTarget)}>
            <Avatar alt={user?.displayName} sx={{ width: 32, height: 32 }}>
              {user?.displayName?.[0]?.toUpperCase() ?? "U"}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={userMenuAnchor}
            open={Boolean(userMenuAnchor)}
            onClose={() => setUserMenuAnchor(null)}
          >
            <MenuItem>
              <ListItemIcon>
                <AccountCircleIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={user?.displayName} secondary={user?.role} />
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Logout" />
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
