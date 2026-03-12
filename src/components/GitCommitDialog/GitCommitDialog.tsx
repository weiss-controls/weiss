// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Stack,
  InputAdornment,
} from "@mui/material";
import TagIcon from "@mui/icons-material/LocalOffer";
import CommitIcon from "@mui/icons-material/Commit";
import { notifyUser } from "@src/services/Notifications/Notification";
import { useUIContext } from "@src/context/useUIContext";
import { commitStagingRepo, syncRepo } from "@src/services/APIClient";

interface GitCommitDialogProps {
  open: boolean;
  repoID: string;
  onClose: () => void;
}

export default function GitCommitDialog({ open, onClose, repoID }: GitCommitDialogProps) {
  const { setDisableGridShortcuts, setReposTreeInfo } = useUIContext();

  const [message, setMessage] = useState("");
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(false);

  const resetAndClose = () => {
    setMessage("");
    setTag("");
    setLoading(false);
    setDisableGridShortcuts(false);
    onClose();
  };

  const handleConfirm = async () => {
    if (!message.trim()) return;

    try {
      setLoading(true);
      await commitStagingRepo({
        path: { repo_id: repoID },
        body: { message: message.trim(), tag: tag.trim() || undefined },
      });
      notifyUser("Commit created successfully.", "success");
      // refresh tree state
      const updt = await syncRepo({ path: { repo_id: repoID } }).then((r) => r.data);
      setReposTreeInfo((prev) => (prev ? prev.map((r) => (updt.id === r.id ? updt : r)) : prev));
      resetAndClose();
    } catch (err) {
      notifyUser(`Commit failed: ${err instanceof Error ? err.message : String(err)}`, "error");
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onFocus={() => setDisableGridShortcuts(true)}
      onBlur={() => setDisableGridShortcuts(false)}
      onClose={resetAndClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Create commit</DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Provide a short commit message. You may optionally create a Git tag.
          </Typography>

          <Stack spacing={2}>
            <TextField
              autoFocus
              fullWidth
              label="Commit message"
              placeholder="e.g. Fix device tree reload"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              error={!message.trim() && message.length > 0}
              helperText={!message.trim() && message.length > 0 ? "Message is required" : " "}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <CommitIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TextField
              fullWidth
              label="Tag (optional)"
              placeholder="e.g. v1.2.0"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <TagIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Stack>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={resetAndClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleConfirm()}
          disabled={!message.trim() || loading}
        >
          Commit
        </Button>
      </DialogActions>
    </Dialog>
  );
}
