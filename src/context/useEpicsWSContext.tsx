// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { createContext, useContext } from "react";
import type useEpicsWS from "./useEpicsWS";
import type { PVData } from "@src/types/epicsWS";

export type EpicsWSContextType = Omit<ReturnType<typeof useEpicsWS>, "pvState">;

export const EpicsWSContext = createContext<EpicsWSContextType | undefined>(undefined);

export const useEpicsWSContext = () => {
  const ctx = useContext(EpicsWSContext);
  if (!ctx) throw new Error("EpicsWSContext not found");
  return ctx;
};

/**
 * Separate context for pvState only.
 * Consumers that only need PV data subscribe here; components like NavBar that
 * use stable WS functions subscribe to EpicsWSContext and are never re-rendered
 * by PV updates.
 */
export const PVStateContext = createContext<Record<string, PVData> | undefined>(undefined);

export const usePVStateContext = () => {
  const ctx = useContext(PVStateContext);
  if (ctx === undefined) throw new Error("PVStateContext not found");
  return ctx;
};

/**
 * Stable context for PV write actions only.
 * Separated from main context to avoid users re-render on every PV update
 */
export type WSActionsContextType = Pick<ReturnType<typeof useEpicsWS>, "writePVValue">;

export const WSActionsContext = createContext<WSActionsContextType | undefined>(undefined);

export const useWSActionsContext = () => {
  const ctx = useContext(WSActionsContext);
  if (!ctx) throw new Error("WSActionsContext not found");
  return ctx;
};
