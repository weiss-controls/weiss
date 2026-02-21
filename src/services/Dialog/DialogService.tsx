import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";
import { registerDialogHandler, unregisterDialogHandler, type DialogPayload } from "./Dialog";

export default function DialogService() {
  const [dialog, setDialog] = useState<DialogPayload | null>(null);

  useEffect(() => {
    registerDialogHandler((d) => setDialog(d));
    return () => unregisterDialogHandler();
  }, []);

  if (!dialog) return null;

  const handleClose = (result: boolean) => {
    dialog.resolve(result);
    setDialog(null);
  };

  return (
    <Dialog open={!!dialog} onClose={() => handleClose(false)}>
      <DialogTitle>{dialog.title}</DialogTitle>
      <DialogContent>
        <Typography>{dialog.message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => handleClose(false)} color="inherit">
          {dialog.cancelText ?? "Cancel"}
        </Button>
        <Button onClick={() => handleClose(true)} variant="contained" color="primary">
          {dialog.confirmText ?? "Confirm"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
