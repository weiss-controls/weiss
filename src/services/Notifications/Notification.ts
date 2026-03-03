// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

export type NotificationSeverity = "success" | "info" | "warning" | "error";

export interface NotificationPayload {
  message: string;
  severity: NotificationSeverity;
}

let handler: ((n: NotificationPayload) => void) | null = null;

export function registerNotificationHandler(fn: (n: NotificationPayload) => void) {
  handler = fn;
}

export function unregisterNotificationHandler() {
  handler = null;
}

export function notifyUser(message: string, severity: NotificationSeverity = "info") {
  if (!handler) {
    console.warn("Notification system not initialized");
    return;
  }

  handler({ message, severity });
}
