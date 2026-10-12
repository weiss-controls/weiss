// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

/** Type of a WebSocket message, indicating the operation or event */
//export type WSMessageType = "update" | "subscribe" | "unsubscribe" | "write";
export type WSMessageType =
  "update" | "subscribe" | "unsubscribe" | "write" | "snapshot" | "restore" | "restore_result";
/** Numeric arrays decoded from binary frames: zero-copy views over the received buffer */
export type NumericArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;
/** Possible PV values: scalar or array of numbers or strings */
export type PVValue = number | number[] | NumericArray | string | string[];
/** Values accepted by PV writes and snapshot restores (must be JSON-serializable) */
export type PVWriteValue = number | number[] | string | string[];

/**
 * EPICS Normative Type support for alarm fields
 * @property severity - Severity of the alarm
 * @property status - Status code of the alarm
 * @property message - Human-readable alarm message
 */
export interface Alarm {
  severity: number;
  status: number;
  message: string;
}

/**
 * EPICS Normative Type support for timeStamp fields
 * @property secondsPastEpoch - Seconds past the Unix epoch
 * @property nanoseconds - Nanoseconds fraction of the second
 * @property userTag - Optional user-defined tag
 */
export interface TimeStamp {
  secondsPastEpoch: number;
  nanoseconds: number;
  userTag: number;
}

/**
 * EPICS Normative Type support for display fields
 * @property limitLow - Optional low display limit
 * @property limitHigh - Optional high display limit
 * @property description - Optional description of the PV
 * @property units - Optional engineering units
 * @property precision - Optional number of decimal places
 * @property form - Optional display format enum index
 * @property choices - Optional list of form string choices
 */
export interface Display {
  limitLow?: number;
  limitHigh?: number;
  description?: string;
  units?: string;
  precision?: number;
  form?: number;
  choices?: string[];
}

/**
 * EPICS Normative Type support for control fields
 * @property limitLow - Optional low control limit
 * @property limitHigh - Optional high control limit
 * @property minStep - Optional minimum step increment allowed
 */
export interface Control {
  limitLow?: number;
  limitHigh?: number;
  minStep?: number;
}

/**
 *  EPICS Normative Type support for valueAlarm fields
 * @property active - Optional, whether an alarm is currently active
 * @property lowAlarmLimit - Optional low alarm limit
 * @property lowWarningLimit - Optional low warning limit
 * @property highWarningLimit - Optional high warning limit
 * @property highAlarmLimit - Optional high alarm limit
 * @property lowAlarmSeverity - Optional severity for low alarm
 * @property lowWarningSeverity - Optional severity for low warning
 * @property highWarningSeverity - Optional severity for high warning
 * @property highAlarmSeverity - Optional severity for high alarm
 * @property hysteresis - Optional hysteresis for alarm transitions
 */
export interface ValueAlarm {
  active?: boolean;
  lowAlarmLimit?: number;
  lowWarningLimit?: number;
  highWarningLimit?: number;
  highAlarmLimit?: number;
  lowAlarmSeverity?: number;
  lowWarningSeverity?: number;
  highWarningSeverity?: number;
  highAlarmSeverity?: number;
  hysteresis?: number;
}

/** Element type names of numeric arrays as sent by the server */
export type NumericDtype =
  | "int8"
  | "uint8"
  | "int16"
  | "uint16"
  | "int32"
  | "uint32"
  | "int64"
  | "uint64"
  | "float32"
  | "float64";

/**
 * NTNDArray dimension_t. Dimensions are ordered fastest-varying first.
 * @property size - Number of elements in the (binned, ROI-cropped) data
 * @property offset - Start of the ROI in the full detector frame
 * @property fullSize - Size of the full frame along this axis
 * @property binning - Binning factor
 * @property reverse - Whether the axis is reversed
 */
export interface NDArrayDimension {
  size: number;
  offset: number;
  fullSize: number;
  binning: number;
  reverse: boolean;
}

/**
 * NTNDArray codec_t.
 * @property name - Codec name; empty when the value holds raw pixels
 * @property dtype - Decoded element type (areaDetector stores it in codec.parameters)
 */
export interface NDArrayCodec {
  name: string;
  dtype?: NumericDtype;
}

/**
 * Metadata of one NTNDArray frame. It belongs to the frame it arrived with and must
 * never be carried over to another frame.
 * @property dimension - Dimensions, fastest axis first (Mono [x, y], RGB1 [3, x, y], RGB2 [x, 3, y], RGB3 [x, y, 3])
 * @property uniqueId - Frame counter
 * @property codec - Compression of the value; when `codec.name` is set the value holds compressed bytes
 * @property compressedSize - Payload size in bytes as reported by the source (unreliable when uncompressed)
 * @property uncompressedSize - Decoded size in bytes as reported by the source
 * @property dataTimeStamp - Acquisition time of the data
 * @property colorMode - areaDetector ColorMode attribute (NDColorMode_t), absent if the source did not send it
 */
export interface NDArrayInfo {
  dimension: NDArrayDimension[];
  uniqueId: number;
  codec: NDArrayCodec;
  compressedSize: number;
  uncompressedSize: number;
  dataTimeStamp: TimeStamp;
  colorMode?: number;
}

/**
 * Processed PV data ready for client-side consumption
 * @property pv - Name of the PV
 * @property value - Value of the PV (scalar or array)
 * @property enumChoices - List of string options if enum PV
 * @property alarm - Optional EPICS NT alarm structure
 * @property timeStamp - Optional EPICS NT timestamp structure
 * @property display - Optional EPICS NT display structure
 * @property control - Optional EPICS NT control structure
 * @property valueAlarm - Optional EPICS NT valueAlarm structure
 * @property ndarray - Metadata of the current frame, only for NTNDArray PVs
 */
export interface PVData {
  pv: string;
  value: PVValue;
  enumChoices?: string[];
  alarm?: Alarm;
  timeStamp: TimeStamp;
  display?: Display;
  control?: Control;
  valueAlarm?: ValueAlarm;
  ndarray?: NDArrayInfo;
}

/**
 * Structure of a WebSocket message exchanged with the PV server
 * @extends PVData
 * @property type - Type of the message (update, write, subscribe, unsubscribe)
 * @property connected - Sent once on (re)connect together with metadata, or as `false` on disconnect
 */
export interface WSMessage extends PVData {
  type: WSMessageType;
  connected?: boolean;
}

/** Collection of PVData objects, keyed by PV name */
export type MultiPvData = Record<string, PVData>;
