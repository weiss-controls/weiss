// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  InputAdornment,
  Stack,
  CircularProgress,
} from "@mui/material";
import CustomGitIcon from "@src/components/CustomIcons/GitIcon";
import type { RepoCreateRequest } from "@src/services/APIClient/types.gen";
import { registerRepo } from "@src/services/APIClient/sdk.gen";
import { notifyUser } from "@src/services/Notifications/Notification";
import { useUIContext } from "@src/context/useUIContext";
import { COLORS } from "@src/constants/constants";

function isHttpsGitUrl(url: string): boolean {
  const httpsPattern = /^https:\/\/[\w.-]+\/[\w.-]+\/[\w.-]+(\.git)?$/;
  return httpsPattern.test(url);
}

function suggestAliasFromGitUrl(url: string): string {
  const normalized = url.replace(/\/$/, "");
  const lastSegment = normalized.split("/").pop() ?? "";
  return lastSegment.replace(/\.git$/, "");
}

interface GitImportDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function GitImportDialog({ open, onClose }: GitImportDialogProps) {
  const { setReposTreeInfo, isDemo } = useUIContext();
  const [alias, setAlias] = useState("");
  const [gitUrl, setGitUrl] = useState(
    isDemo ? "https://github.com/weiss-controls/weiss-demo-opis.git" : "",
  );
  const [aliasEdited, setAliasEdited] = useState(false);
  const [loading, setLoading] = useState(false);

  const gitUrlValid = isHttpsGitUrl(gitUrl.trim());

  const showGitUrlError = gitUrl.length > 0 && !gitUrlValid;

  useEffect(() => {
    if (!aliasEdited && gitUrl.trim() && gitUrlValid) {
      setAlias(suggestAliasFromGitUrl(gitUrl.trim()));
    }
  }, [gitUrl, aliasEdited, gitUrlValid]);

  const resetAndClose = () => {
    setAlias("");
    setGitUrl("");
    setAliasEdited(false);
    setLoading(false);
    onClose();
  };

  const handleConfirm = async () => {
    if (!alias.trim() || !gitUrlValid) return;

    const payload: RepoCreateRequest = {
      alias: alias.trim(),
      git_url: gitUrl.trim(),
    };

    try {
      setLoading(true);
      const newTree = await registerRepo({ body: payload }).then((r) => r.data);
      notifyUser("Git repository imported successfully.", "success");
      setReposTreeInfo(newTree);
      resetAndClose();
    } catch (err) {
      notifyUser(`Git import failed: ${err instanceof Error ? err.message : String(err)}`, "error");
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={resetAndClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import from Git repository</DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {`Provide the HTTPS URL of the repository.`}
          </Typography>

          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Git repository URL"
              placeholder={"https://github.com/org/repo.git"}
              value={gitUrl}
              onChange={(e) => setGitUrl(e.target.value)}
              error={showGitUrlError}
              helperText={showGitUrlError ? `Enter a valid Git HTTPS URL` : " "}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <CustomGitIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TextField
              autoFocus
              fullWidth
              label="Repository alias"
              value={alias}
              onChange={(e) => {
                setAlias(e.target.value);
                setAliasEdited(true);
              }}
            />
          </Stack>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={resetAndClose}
          disabled={loading}
          sx={{ "&:not(.Mui-disabled)": { color: COLORS.midDarkBlue } }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleConfirm()}
          disabled={!alias.trim() || !gitUrlValid || loading}
          sx={{ "&:not(.Mui-disabled)": { backgroundColor: COLORS.midDarkBlue } }}
        >
          {loading && (
            <CircularProgress
              size={30}
              sx={{
                position: "absolute",
                left: "50%",
                top: "50%",
                marginLeft: "-15px",
                marginTop: "-15px",
                zIndex: 1,
              }}
            />
          )}
          <span style={{ opacity: loading ? 0 : 1 }}>Import</span>
        </Button>
      </DialogActions>
    </Dialog>
  );
}
