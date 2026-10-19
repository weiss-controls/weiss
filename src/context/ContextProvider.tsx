// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { useEffect } from "react";
import { setSubscribedPVs } from "@src/services/WSClient/session";
import { useEditorStore } from "@src/stores/editorStore";
import { UIContext } from "./useUIContext";
import useUIManager from "./useUIManager";

/** Provides the UI context and passes the resolved PV list to the WebSocket session. */
export const ContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const resolvedPVList = useEditorStore((s) => s.resolvedPVList);

  useEffect(() => {
    setSubscribedPVs(resolvedPVList);
  }, [resolvedPVList]);

  const ui = useUIManager();
  return <UIContext.Provider value={ui}>{children}</UIContext.Provider>;
};
