// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { UIContext } from "./useUIContext";
import useUIManager from "./useUIManager";

/** Provides the UI context. */
export const ContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ui = useUIManager();
  return <UIContext.Provider value={ui}>{children}</UIContext.Provider>;
};
