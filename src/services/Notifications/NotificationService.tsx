// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { useEffect, useState } from "react";
import { Snackbar, Alert } from "@mui/material";
import {
  registerNotificationHandler,
  unregisterNotificationHandler,
  type NotificationPayload,
} from "./Notification";

export default function NotificationService() {
  const [open, setOpen] = useState(false);
  const [notification, setNotification] = useState<NotificationPayload | null>(null);

  useEffect(() => {
    registerNotificationHandler((n) => {
      setNotification(n);
      setOpen(true);
    });

    return () => {
      unregisterNotificationHandler();
    };
  }, []);

  if (!notification) {
    return null;
  }

  return (
    <Snackbar
      open={open}
      autoHideDuration={4000}
      onClose={() => setOpen(false)}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
    >
      <Alert
        onClose={() => setOpen(false)}
        severity={notification.severity}
        variant="filled"
        sx={{ width: "100%", "& .MuiAlert-message": { whiteSpace: "pre-line" } }}
      >
        {notification.message}
      </Alert>
    </Snackbar>
  );
}
