// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

/** Type of a WebSocket message, indicating the operation or event */
//export type WSMessageType = "update" | "subscribe" | "unsubscribe" | "write";
export type WSMessageType =
  | "update"
  | "subscribe"
  | "unsubscribe"
  | "write"
  | "snapshot"
  | "restore"
  | "restore_result";
/** Possible PV values: scalar or array of numbers or strings */
export type PVValue = number | number[] | string | string[];

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
}

/**
 * Structure of a WebSocket message exchanged with the PV server
 * @extends PVData
 * @property type - Type of the message (update, write, subscribe, unsubscribe)
 * @property b64arr - Optional base64-encoded array data
 * @property b64dtype - Optional data type of the base64-encoded array
 * @property connected - Sent once on (re)connect together with metadata, or as `false` on disconnect
 */
export interface WSMessage extends PVData {
  type: WSMessageType;
  b64arr?: string;
  b64dtype?: string;
  connected?: boolean;
}

/** Collection of PVData objects, keyed by PV name */
export type MultiPvData = Record<string, PVData>;
