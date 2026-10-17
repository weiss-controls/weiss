// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { LEVELS } from "./intensity.ts";

/** RGB color, 0..255 per component */
export type ColorStop = readonly [number, number, number];

// viridis and inferno are matplotlib's (CC0, by Nathaniel Smith and Stefan van der Walt), turbo is
// Google's (Apache-2.0, by Anton Mikhailov): every fifth entry of their 256-entry tables, which
// interpolate back to within 1/255 of the originals.
export const COLOR_MAPS = {
  grayscale: [
    [0, 0, 0],
    [255, 255, 255],
  ],
  viridis: [
    [68, 1, 84],
    [70, 8, 92],
    [71, 16, 99],
    [72, 23, 105],
    [72, 29, 111],
    [72, 36, 117],
    [71, 42, 122],
    [70, 48, 126],
    [69, 55, 129],
    [67, 61, 132],
    [65, 66, 135],
    [63, 72, 137],
    [61, 78, 138],
    [58, 83, 139],
    [56, 89, 140],
    [53, 94, 141],
    [51, 99, 141],
    [49, 104, 142],
    [46, 109, 142],
    [44, 113, 142],
    [42, 118, 142],
    [41, 123, 142],
    [39, 128, 142],
    [37, 132, 142],
    [35, 137, 142],
    [33, 142, 141],
    [32, 146, 140],
    [31, 151, 139],
    [30, 156, 137],
    [31, 161, 136],
    [33, 165, 133],
    [36, 170, 131],
    [40, 174, 128],
    [46, 179, 124],
    [53, 183, 121],
    [61, 188, 116],
    [70, 192, 111],
    [80, 196, 106],
    [90, 200, 100],
    [101, 203, 94],
    [112, 207, 87],
    [124, 210, 80],
    [137, 213, 72],
    [149, 216, 64],
    [162, 218, 55],
    [176, 221, 47],
    [189, 223, 38],
    [202, 225, 31],
    [216, 226, 25],
    [229, 228, 25],
    [241, 229, 29],
    [253, 231, 37],
  ],
  inferno: [
    [0, 0, 4],
    [2, 2, 12],
    [5, 4, 23],
    [10, 7, 34],
    [16, 9, 45],
    [22, 11, 57],
    [30, 12, 69],
    [38, 12, 81],
    [47, 10, 91],
    [56, 9, 98],
    [64, 10, 103],
    [73, 11, 106],
    [81, 14, 108],
    [89, 16, 110],
    [97, 19, 110],
    [105, 22, 110],
    [113, 25, 110],
    [120, 28, 109],
    [128, 31, 108],
    [136, 34, 106],
    [144, 37, 104],
    [152, 39, 102],
    [160, 42, 99],
    [168, 46, 95],
    [176, 49, 91],
    [183, 53, 87],
    [191, 57, 82],
    [198, 61, 77],
    [204, 66, 72],
    [211, 71, 67],
    [217, 77, 61],
    [223, 83, 55],
    [228, 90, 49],
    [233, 97, 43],
    [237, 105, 37],
    [241, 113, 31],
    [244, 121, 24],
    [247, 130, 18],
    [249, 139, 11],
    [250, 148, 7],
    [251, 157, 7],
    [252, 166, 12],
    [252, 176, 20],
    [251, 186, 31],
    [250, 196, 42],
    [248, 205, 55],
    [246, 215, 70],
    [244, 225, 86],
    [242, 234, 105],
    [242, 242, 125],
    [245, 249, 146],
    [252, 255, 164],
  ],
  turbo: [
    [48, 18, 59],
    [54, 33, 95],
    [59, 47, 128],
    [63, 62, 156],
    [66, 75, 181],
    [69, 89, 203],
    [70, 102, 221],
    [71, 115, 235],
    [70, 128, 246],
    [69, 140, 253],
    [64, 153, 255],
    [56, 165, 251],
    [47, 178, 244],
    [39, 190, 233],
    [31, 201, 221],
    [26, 212, 208],
    [24, 221, 194],
    [26, 228, 182],
    [34, 235, 170],
    [47, 241, 155],
    [63, 246, 138],
    [82, 250, 122],
    [101, 253, 105],
    [121, 254, 89],
    [139, 255, 75],
    [156, 254, 64],
    [169, 251, 57],
    [183, 247, 53],
    [195, 241, 52],
    [208, 234, 52],
    [219, 226, 54],
    [229, 217, 56],
    [238, 207, 58],
    [245, 197, 58],
    [250, 186, 57],
    [253, 174, 53],
    [254, 161, 48],
    [254, 147, 42],
    [252, 132, 35],
    [249, 117, 29],
    [244, 102, 23],
    [239, 88, 17],
    [232, 75, 12],
    [225, 65, 9],
    [216, 55, 6],
    [206, 45, 4],
    [195, 37, 3],
    [183, 29, 2],
    [169, 22, 1],
    [155, 15, 1],
    [139, 9, 2],
    [122, 4, 3],
  ],
} as const satisfies Record<string, readonly ColorStop[]>;

export type ColorMapName = keyof typeof COLOR_MAPS;

export function isColorMapName(name: unknown): name is ColorMapName {
  return typeof name === "string" && Object.hasOwn(COLOR_MAPS, name);
}

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
