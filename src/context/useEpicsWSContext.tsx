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
