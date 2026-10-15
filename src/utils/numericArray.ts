// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { NumericArray } from "@src/types/epicsWS";

/** Numeric arrays to be converted to text typically represent strings encoded into utf-8 ASCII chars. 1000 elements should be more than enought to cover that case. Do not convert larger arrays to text. */
const LARGE_ARRAY_THRESHOLD = 1000;

export function isLargeArray(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > LARGE_ARRAY_THRESHOLD;
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    return (value as unknown as { length: number }).length > LARGE_ARRAY_THRESHOLD;
  }
  return false;
}

/** A typed array as decoded from a binary update */
export function isTypedNumericArray(value: unknown): value is NumericArray {
  return ArrayBuffer.isView(value) && !(value instanceof DataView);
}

export function isNumericArray(value: unknown): value is NumericArray | number[] {
  if (ArrayBuffer.isView(value)) return isTypedNumericArray(value);
  return Array.isArray(value) && value.every((v) => typeof v === "number");
}
