// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

/** Short text for a pixel value or limit */
export function formatValue(value: number): string {
  // 64-bit integers arrive as doubles; integral values are shown in full
  return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(6)));
}
