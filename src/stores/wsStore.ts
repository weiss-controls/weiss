// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface WSStoreState {
  wsConnected: boolean;
  setWSConnected: (connected: boolean) => void;
}

/** Connection state of the PV WebSocket session (`services/WSClient/session.ts`) */
export const useWSStore = create<WSStoreState>()(
  devtools(
    (set) => ({
      wsConnected: false,
      setWSConnected: (wsConnected) => set({ wsConnected }),
    }),
    { name: "wsStore", enabled: import.meta.env.DEV },
  ),
);
