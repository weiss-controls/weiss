// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

// useUIContext.ts
import { createContext, useContext } from "react";
import type useUIManager from "./useUIManager";

export type UIContextType = ReturnType<typeof useUIManager>;

export const UIContext = createContext<UIContextType | undefined>(undefined);

export const useUIContext = () => {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("UIContext not found");
  return ctx;
};
