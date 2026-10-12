// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { LEVELS } from "./intensity.ts";

/** RGB color, 0..255 per component */
export type ColorStop = readonly [number, number, number];

export const COLOR_MAPS = {
  grayscale: [
    [0, 0, 0],
    [255, 255, 255],
  ],
} as const satisfies Record<string, readonly ColorStop[]>;

export type ColorMapName = keyof typeof COLOR_MAPS;

/** RGBA table of LEVELS entries, interpolated linearly between evenly spaced stops */
export function buildColorTable(stops: readonly ColorStop[]): Uint8ClampedArray {
  if (stops.length < 2) throw new Error("A color map needs at least two stops");
  const table = new Uint8ClampedArray(LEVELS * 4);
  for (let level = 0; level < LEVELS; level++) {
    const position = (level / (LEVELS - 1)) * (stops.length - 1);
    const index = Math.min(Math.floor(position), stops.length - 2);
    const fraction = position - index;
    for (let c = 0; c < 3; c++) {
      table[level * 4 + c] = stops[index][c] + (stops[index + 1][c] - stops[index][c]) * fraction;
    }
    table[level * 4 + 3] = 255;
  }
  return table;
}

const tables = new Map<ColorMapName, Uint8ClampedArray>();

export function getColorTable(name: ColorMapName): Uint8ClampedArray {
  let table = tables.get(name);
  if (!table) {
    table = buildColorTable(COLOR_MAPS[name]);
    tables.set(name, table);
  }
  return table;
}
