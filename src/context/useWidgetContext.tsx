// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

// useWidgetContext.ts
import { createContext, useContext } from "react";
import type { useWidgetManager } from "./useWidgetManager";

export type WidgetContextType = ReturnType<typeof useWidgetManager>;

export const WidgetContext = createContext<WidgetContextType | undefined>(undefined);

export const useWidgetContext = () => {
  const ctx = useContext(WidgetContext);
  if (!ctx) throw new Error("WidgetContext not found");
  return ctx;
};
