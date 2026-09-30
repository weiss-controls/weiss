// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { WSMessage } from "@src/types/epicsWS";

const types = {
  int8: [1, Int8Array],
  uint8: [1, Uint8Array],
  int16: [2, Int16Array],
  uint16: [2, Uint16Array],
  int32: [4, Int32Array],
  uint32: [4, Uint32Array],
  int64: [8, BigInt64Array],
  uint64: [8, BigUint64Array],
  float64: [8, Float64Array],
} as const;

const littleEndian = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

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

  let value: number[];
  if (dtype === "int64" || dtype === "uint64") {
    if (littleEndian) {
      const ArrayType = dtype === "int64" ? BigInt64Array : BigUint64Array;
      value = Array.from(new ArrayType(buffer, offset, length / size), Number);
    } else {
      const view = new DataView(buffer, offset, length);
      value = Array.from({ length: length / size }, (_, index) =>
        Number(
          dtype === "int64"
            ? view.getBigInt64(index * size, true)
            : view.getBigUint64(index * size, true),
        ),
      );
    }
  } else if (littleEndian) {
    const NumericArrayType = ArrayType as
      | Int8ArrayConstructor
      | Uint8ArrayConstructor
      | Int16ArrayConstructor
      | Uint16ArrayConstructor
      | Int32ArrayConstructor
      | Uint32ArrayConstructor
      | Float64ArrayConstructor;
    value = Array.from(new NumericArrayType(buffer, offset, length / size));
  } else {
    const view = new DataView(buffer, offset, length);
    value = Array.from({ length: length / size }, (_, index) => {
      const position = index * size;
      switch (dtype) {
        case "int8":
          return view.getInt8(position);
        case "uint8":
          return view.getUint8(position);
        case "int16":
          return view.getInt16(position, true);
        case "uint16":
          return view.getUint16(position, true);
        case "int32":
          return view.getInt32(position, true);
        case "uint32":
          return view.getUint32(position, true);
        case "float64":
          return view.getFloat64(position, true);
        default:
          throw new Error("Unsupported binary update dtype");
      }
    });
  }

  const { dtype: unused, ...fields } = header;
  void unused;
  return { ...fields, value } as WSMessage;
}
