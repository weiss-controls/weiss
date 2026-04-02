// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { createContext, useContext } from "react";
import type useEpicsWS from "./useEpicsWS";

export type EpicsWSContextType = ReturnType<typeof useEpicsWS>;

export const EpicsWSContext = createContext<EpicsWSContextType | undefined>(undefined);

export const useEpicsWSContext = () => {
  const ctx = useContext(EpicsWSContext);
  if (!ctx) throw new Error("EpicsWSContext not found");
  return ctx;
};

/**
 * Stable context for PV write actions only.
 * Separated from main context to avoid users re-render on every PV update
 */
export type WSActionsContextType = Pick<EpicsWSContextType, "writePVValue">;

export const WSActionsContext = createContext<WSActionsContextType | undefined>(undefined);

export const useWSActionsContext = () => {
  const ctx = useContext(WSActionsContext);
  if (!ctx) throw new Error("WSActionsContext not found");
  return ctx;
};
