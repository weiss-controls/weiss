export interface DialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

export interface DialogPayload extends DialogOptions {
  resolve: (result: boolean) => void;
}

let handler: ((dialog: DialogPayload) => void) | null = null;

export function registerDialogHandler(fn: (dialog: DialogPayload) => void) {
  handler = fn;
}

export function unregisterDialogHandler() {
  handler = null;
}

/**
 * Opens a confirmation dialog and returns a promise resolved with true if confirmed, false if cancelled.
 */
export function confirmDialog(options: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!handler) {
      console.warn("Dialog system not initialized");
      resolve(false);
      return;
    }
    handler({ ...options, resolve });
  });
}
