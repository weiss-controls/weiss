// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { NumericArray, WSMessage } from "@src/types/epicsWS";

const types = {
  int8: [1, Int8Array],
  uint8: [1, Uint8Array],
  int16: [2, Int16Array],
  uint16: [2, Uint16Array],
  int32: [4, Int32Array],
  uint32: [4, Uint32Array],
  int64: [8, BigInt64Array],
  uint64: [8, BigUint64Array],
  float32: [4, Float32Array],
  float64: [8, Float64Array],
} as const;

const littleEndian = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

const bigEndianReaders: Record<keyof typeof types, (view: DataView, pos: number) => number> = {
  int8: (v, p) => v.getInt8(p),
  uint8: (v, p) => v.getUint8(p),
  int16: (v, p) => v.getInt16(p, true),
  uint16: (v, p) => v.getUint16(p, true),
  int32: (v, p) => v.getInt32(p, true),
  uint32: (v, p) => v.getUint32(p, true),
  int64: (v, p) => Number(v.getBigInt64(p, true)),
  uint64: (v, p) => Number(v.getBigUint64(p, true)),
  float32: (v, p) => v.getFloat32(p, true),
  float64: (v, p) => v.getFloat64(p, true),
};

export function decodeBinaryUpdate(buffer: ArrayBuffer): WSMessage {
  if (buffer.byteLength < 4) throw new Error("Truncated binary update");
  const headerLength = new DataView(buffer).getUint32(0, true);
  const offset = 4 + headerLength;
  if (offset > buffer.byteLength) throw new Error("Truncated binary update header");

  const header: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(buffer, 4, headerLength)),
  );
  if (
    typeof header !== "object" ||
    header === null ||
    !("type" in header) ||
    header.type !== "update" ||
    !("pv" in header) ||
    typeof header.pv !== "string" ||
    !("dtype" in header) ||
    typeof header.dtype !== "string" ||
    !(header.dtype in types)
  ) {
    throw new Error("Invalid binary update header");
  }

  const dtype = header.dtype as keyof typeof types;
  const [size, ArrayType] = types[dtype];
  const length = buffer.byteLength - offset;
  if (offset % size !== 0 || length === 0 || length % size !== 0) {
    throw new Error("Invalid binary update payload");
  }
  const count = length / size;

  let value: NumericArray;
  if (!littleEndian) {
    const view = new DataView(buffer, offset, length);
    const read = bigEndianReaders[dtype];
    value = new Float64Array(count);
    for (let i = 0; i < count; i++) value[i] = read(view, i * size);
  } else if (dtype === "int64" || dtype === "uint64") {
    // No safe 64-bit integer view in JS; values beyond 2^53 lose precision
    value = Float64Array.from(
      new (ArrayType as typeof BigInt64Array)(buffer, offset, count),
      Number,
    );
  } else {
    value = new (
      ArrayType as Exclude<typeof ArrayType, typeof BigInt64Array | typeof BigUint64Array>
    )(buffer, offset, count);
  }

  const { dtype: unused, ...fields } = header;
  void unused;
  return { ...fields, value } as WSMessage;
}
