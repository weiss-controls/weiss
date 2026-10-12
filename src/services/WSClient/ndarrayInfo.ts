// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type {
  NDArrayCodec,
  NDArrayDimension,
  NDArrayInfo,
  NumericDtype,
  TimeStamp,
} from "@src/types/epicsWS";

// areaDetector's ND_ARRAY_MAX_DIMS
const MAX_DIMENSIONS = 10;

const NUMERIC_DTYPES: ReadonlySet<string> = new Set<NumericDtype>([
  "int8",
  "uint8",
  "int16",
  "uint16",
  "int32",
  "uint32",
  "int64",
  "uint64",
  "float32",
  "float64",
]);

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid NDArray ${what}`);
  }
  return value as Record<string, unknown>;
}

function asInt(value: unknown, what: string, min = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min) {
    throw new Error(`Invalid NDArray ${what}`);
  }
  return value;
}

function parseDimension(raw: unknown): NDArrayDimension {
  const dim = asRecord(raw, "dimension");
  if (typeof dim.reverse !== "boolean") throw new Error("Invalid NDArray dimension.reverse");
  return {
    size: asInt(dim.size, "dimension.size"),
    offset: asInt(dim.offset, "dimension.offset"),
    fullSize: asInt(dim.fullSize, "dimension.fullSize"),
    binning: asInt(dim.binning, "dimension.binning", 1),
    reverse: dim.reverse,
  };
}

function parseCodec(raw: unknown): NDArrayCodec {
  const codec = asRecord(raw, "codec");
  if (typeof codec.name !== "string") throw new Error("Invalid NDArray codec.name");
  if (codec.dtype === undefined || codec.dtype === null) return { name: codec.name };
  if (typeof codec.dtype !== "string" || !NUMERIC_DTYPES.has(codec.dtype)) {
    throw new Error("Invalid NDArray codec.dtype");
  }
  return { name: codec.name, dtype: codec.dtype as NumericDtype };
}

function parseTimeStamp(raw: unknown): TimeStamp {
  const ts = asRecord(raw, "dataTimeStamp");
  return {
    secondsPastEpoch: asInt(ts.secondsPastEpoch, "dataTimeStamp.secondsPastEpoch", -Infinity),
    nanoseconds: asInt(ts.nanoseconds, "dataTimeStamp.nanoseconds", -Infinity),
    userTag: asInt(ts.userTag, "dataTimeStamp.userTag", -Infinity),
  };
}

/** Validates the untrusted `ndarray` header field of a WebSocket update; throws if malformed. */
export function parseNDArrayInfo(raw: unknown): NDArrayInfo {
  const info = asRecord(raw, "info");
  if (
    !Array.isArray(info.dimension) ||
    info.dimension.length < 1 ||
    info.dimension.length > MAX_DIMENSIONS
  ) {
    throw new Error("Invalid NDArray dimension list");
  }
  const parsed: NDArrayInfo = {
    dimension: info.dimension.map(parseDimension),
    uniqueId: asInt(info.uniqueId, "uniqueId", -Infinity),
    codec: parseCodec(info.codec),
    compressedSize: asInt(info.compressedSize, "compressedSize"),
    uncompressedSize: asInt(info.uncompressedSize, "uncompressedSize"),
    dataTimeStamp: parseTimeStamp(info.dataTimeStamp),
  };
  if (info.colorMode !== undefined && info.colorMode !== null) {
    parsed.colorMode = asInt(info.colorMode, "colorMode");
  }
  return parsed;
}
