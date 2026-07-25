// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { Box, Typography, Button, Paper, Tooltip } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import IntegrationInstructionsIcon from "@mui/icons-material/IntegrationInstructions";
import PermIdentityIcon from "@mui/icons-material/PermIdentity";
import { OAuthProviders, Roles, type OAuthProvider } from "@src/services/AuthService/AuthService";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { APP_SRC_URL, APP_VERSION, COLORS } from "@src/constants/constants";
import GitHubIcon from "@mui/icons-material/GitHub";
import IconButton from "@mui/material/IconButton";
import { useUIContext } from "@src/context/useUIContext";

export default function LoginPage() {
  const { login, isAuthenticated, user, isDemo } = useUIContext();
  const navigate = useNavigate();

  const configuredProvider =
    import.meta.env.VITE_AUTH_IDENTITY_PROVIDER === OAuthProviders.MICROSOFT ||
    import.meta.env.VITE_AUTH_IDENTITY_PROVIDER === OAuthProviders.OAUTH
      ? (import.meta.env.VITE_AUTH_IDENTITY_PROVIDER as OAuthProvider)
      : OAuthProviders.OAUTH;

  useEffect(() => {
    if (isAuthenticated && user) {
      void navigate("/", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleLogin = async (provider: OAuthProvider, demoRole?: Roles) => {
    await login(provider, demoRole);
  };

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: COLORS.backgroundColor,
        padding: 2,
      }}
    >
      <Paper
        elevation={4}
        sx={{
          padding: 4,
          width: 350,
          borderRadius: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          backgroundColor: "#fff",
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Welcome to WEISS
        </Typography>
        <Typography variant="subtitle1" sx={{ color: COLORS.midDarkBlue }}>
          Sign in with
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}>
          {isDemo && (
            <>
              <Button
                variant="contained"
                startIcon={<PersonIcon />}
                onClick={() => void handleLogin(OAuthProviders.DEMO, Roles.OPERATOR)}
                sx={{
                  backgroundColor: COLORS.titleBarColor,
                  textTransform: "none",
                  "&:hover": { backgroundColor: COLORS.midDarkBlue },
                }}
              >
                Demo Operator
              </Button>
              <Button
                variant="contained"
                startIcon={<IntegrationInstructionsIcon />}
                onClick={() => void handleLogin(OAuthProviders.DEMO, Roles.DEVELOPER)}
                sx={{
                  backgroundColor: COLORS.titleBarColor,
                  textTransform: "none",
                  "&:hover": { backgroundColor: COLORS.midDarkBlue },
                }}
              >
                Demo Developer
              </Button>
            </>
          )}

          <Tooltip title={isDemo ? "Disabled in Demo Mode" : "OAuth provider"}>
            <Button
              disabled={isDemo}
              variant="outlined"
              startIcon={<PermIdentityIcon />}
              onClick={() => void handleLogin(configuredProvider)}
              sx={{
                borderColor: COLORS.titleBarColor,
                color: COLORS.midDarkBlue,
                textTransform: "none",
                "&.Mui-disabled": {
                  pointerEvents: "visible",
                  ":hover": { backgroundColor: "white" },
                },
              }}
            >
              Organization account
            </Button>
          </Tooltip>
        </Box>
        <Box
          sx={{
            marginTop: 2,
            paddingTop: 1,
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid #eee",
          }}
        >
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Web EPICS Interface & Synoptic Studio @ {APP_VERSION}
          </Typography>

          <Tooltip title="View source on GitHub">
            <IconButton
              size="small"
              onClick={() => window.open(APP_SRC_URL, "_blank", "noopener,noreferrer")}
            >
              <GitHubIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>
    </Box>
  );
}
