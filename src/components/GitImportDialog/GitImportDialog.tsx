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
} from "@mui/material";
import CustomGitIcon from "@src/components/CustomIcons/GitIcon";
import type { RepoCreateRequest } from "@src/services/APIClient/types.gen";
import { registerRepo } from "@src/services/APIClient/sdk.gen";
import { notifyUser } from "@src/services/Notifications/Notification";
import { useUIContext } from "@src/context/useUIContext";

function isHttpsGitUrl(url: string): boolean {
  const httpsPattern = /^https:\/\/[\w.-]+\/[\w.-]+\/[\w.-]+(\.git)?$/;
  return httpsPattern.test(url);
}

function isSshGitUrl(url: string): boolean {
  const sshPattern = /^(git@|ssh:\/\/)/;
  return sshPattern.test(url);
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
  const { setReleaseShortcuts, updateReposTreeInfo, sshEnabled } = useUIContext();
  const [alias, setAlias] = useState("");
  const [gitUrl, setGitUrl] = useState("");
  const [aliasEdited, setAliasEdited] = useState(false);
  const [loading, setLoading] = useState(false);

  const gitUrlValid = sshEnabled ? isSshGitUrl(gitUrl.trim()) : isHttpsGitUrl(gitUrl.trim());

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
      await registerRepo({ body: payload });
      notifyUser("Git repository imported successfully.", "success");
      await updateReposTreeInfo();
      resetAndClose();
    } catch (err) {
      notifyUser(`Git import failed: ${err instanceof Error ? err.message : String(err)}`, "error");
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onFocus={() => setReleaseShortcuts(true)}
      onBlur={() => setReleaseShortcuts(false)}
      onClose={resetAndClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Import from Git repository</DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {`Provide the ${sshEnabled ? "SSH" : "HTTPS"} URL of the repository.`}
          </Typography>

          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Git repository URL"
              placeholder={
                sshEnabled ? "git@github.com:org/repo.git" : "https://github.com/org/repo.git"
              }
              value={gitUrl}
              onChange={(e) => setGitUrl(e.target.value)}
              error={showGitUrlError}
              helperText={
                showGitUrlError ? `Enter a valid Git ${sshEnabled ? "SSH" : "HTTPS"} URL` : " "
              }
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
        <Button onClick={resetAndClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleConfirm()}
          disabled={!alias.trim() || !gitUrlValid || loading}
        >
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
}
