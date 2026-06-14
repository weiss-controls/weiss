// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { PVValue } from "@src/types/epicsWS";
import type { ValueDisplayFormat } from "@src/types/widgets";

function toEngineeringNotation(value: number, precision?: number): string {
  if (value === 0) return "0";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const exp = Math.floor(Math.log10(abs));
  const engExp = Math.floor(exp / 3) * 3;
  const mantissa = abs / Math.pow(10, engExp);
  const formatted =
    precision !== undefined
      ? mantissa.toFixed(precision)
      : parseFloat(mantissa.toPrecision(4)).toString();
  const expStr = engExp >= 0 ? `e+${engExp}` : `e${engExp}`;
  return `${sign}${formatted}${expStr}`;
}

/**
 * Formats a PV value according to the specified display format.
 * @param value - The raw PV value to format.
 * @param format - The display format to apply.
 * @param precision - Optional decimal precision for numeric formats.
 */
export function formatDisplayValue(
  value: PVValue,
  format: ValueDisplayFormat,
  precision?: number,
): string {
  if (value === undefined || value === null) return "";

  switch (format) {
    case "String":
      if (Array.isArray(value) && value.every((v) => typeof v === "number")) {
        // Int8 char-code array to string; strip null terminator
        return String.fromCharCode(...value.filter((c) => c !== 0));
      }
      return String(value);

    case "Hexadecimal": {
      const num = Number(value);
      if (isNaN(num)) return String(value);
      return `0x${Math.trunc(num).toString(16).toUpperCase()}`;
    }

    case "Scientific": {
      const num = Number(value);
      if (isNaN(num)) return String(value);
      return precision !== undefined ? num.toExponential(precision) : num.toExponential();
    }

    case "Engineering": {
      const num = Number(value);
      if (isNaN(num)) return String(value);
      return toEngineeringNotation(num, precision);
    }

    case "Timestamp": {
      const num = Number(value);
      if (isNaN(num)) return String(value);
      return new Date(num * 1000).toLocaleString();
    }

    case "Default":
    default: {
      if (typeof value === "number") {
        return precision !== undefined ? value.toFixed(precision) : String(value);
      }
      return String(value);
    }
  }
}
