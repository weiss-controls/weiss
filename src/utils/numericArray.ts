// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { NumericArray } from "@src/types/epicsWS";

export function isNumericArray(value: unknown): value is NumericArray | number[] {
  if (ArrayBuffer.isView(value)) return !(value instanceof DataView);
  return Array.isArray(value) && value.every((v) => typeof v === "number");
}
