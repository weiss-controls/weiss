# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 André Favoto

from __future__ import annotations

import base64
import math
from dataclasses import asdict, dataclass
from typing import Any, List, Optional, Union

import numpy as np
from p4p.wrapper import Value as p4pValue


# NormativeType data definitions
# See: https://docs.epics-controls.org/en/latest/pv-access/Normative-Types-Specification.html
@dataclass
class Alarm:
    severity: int = 0
    status: int = 0
    message: str = "NO_ALARM"


@dataclass
class TimeStamp:
    secondsPastEpoch: int = 0
    nanoseconds: int = 0
    userTag: int = 0


@dataclass
class Display:
    limitLow: Optional[float] = None
    limitHigh: Optional[float] = None
    description: Optional[str] = None
    units: Optional[str] = None
    precision: Optional[int] = None
    form: Optional[int] = None
    choices: Optional[List[str]] = None


@dataclass
class Control:
    limitLow: Optional[float] = None
    limitHigh: Optional[float] = None
    minStep: Optional[float] = None


@dataclass
class ValueAlarm:
    active: Optional[bool] = None
    lowAlarmLimit: Optional[float] = None
    lowWarningLimit: Optional[float] = None
    highWarningLimit: Optional[float] = None
    highAlarmLimit: Optional[float] = None
    lowAlarmSeverity: Optional[int] = None
    lowWarningSeverity: Optional[int] = None
    highWarningSeverity: Optional[int] = None
    highAlarmSeverity: Optional[int] = None
    hysteresis: Optional[float] = None


@dataclass
class PVMetadata:
    display: Display
    control: Control
    valueAlarm: ValueAlarm


@dataclass
class PVData:
    pv: Optional[str]
    alarm: Alarm
    timeStamp: TimeStamp
    value: Optional[Union[float, int, str, List[float], List[int], List[str]]] = None
    enumChoices: Optional[List[str]] = None
    display: Optional[Display] = None
    control: Optional[Control] = None
    valueAlarm: Optional[ValueAlarm] = None
    connected: Optional[bool] = False
    rawArray: Optional[bytes] = None
    dtype: Optional[str] = None


ARRAY_DTYPES = frozenset(
    ("int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64", "float32", "float64")
)


def encode_array_raw(arr: Any) -> tuple[Optional[bytes], Optional[str]]:
    if arr is None:
        return None, None

    array = np.asarray(arr)
    if array.size == 0:
        return None, None

    dtype = array.dtype.name
    if dtype not in ARRAY_DTYPES:
        if array.dtype.kind != "f":
            return None, None
        dtype = "float32" if array.dtype.itemsize < 4 else "float64"

    encoded = array.astype(np.dtype(dtype).newbyteorder("<"), copy=False)
    return encoded.tobytes(), dtype


def safe_get_nan(obj, key: str):
    value = obj.get(key)
    return None if isinstance(value, float) and math.isnan(value) else value


def _normalize_value(value):
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, np.ndarray):
        return value.tolist()
    return value


class PVParser:
    @staticmethod
    def pva_update(pv_obj, pv_name: Optional[str] = None) -> PVData:
        value_field = pv_obj.get("value")
        value = enum_choices = raw_array = dtype = None

        if isinstance(value_field, (int, float, str)):
            value = value_field
        elif isinstance(value_field, p4pValue) and value_field.has("index") and value_field.has("choices"):
            value = value_field.get("index")
            enum_choices = value_field.get("choices")
        elif isinstance(value_field, (list, np.ndarray)):
            raw_array, dtype = encode_array_raw(value_field)
            if raw_array is None:
                value = _normalize_value(value_field)

        alarm_data = pv_obj.get("alarm", {})
        timestamp_data = pv_obj.get("timeStamp", {})
        return PVData(
            pv=pv_name,
            value=value,
            enumChoices=enum_choices,
            alarm=Alarm(
                severity=alarm_data.get("severity", 0),
                status=alarm_data.get("status", 0),
                message=alarm_data.get("message", "NO_ALARM"),
            ),
            timeStamp=TimeStamp(
                secondsPastEpoch=timestamp_data.get("secondsPastEpoch", 0),
                nanoseconds=timestamp_data.get("nanoseconds", 0),
                userTag=timestamp_data.get("userTag", 0),
            ),
            rawArray=raw_array,
            dtype=dtype,
        )

    @staticmethod
    def pva_metadata(pv_obj) -> PVMetadata:
        display_data = pv_obj.get("display", {})
        control_data = pv_obj.get("control", {})
        alarm_data = pv_obj.get("valueAlarm", {})
        form = display_data.get("form")

        return PVMetadata(
            display=Display(
                limitLow=display_data.get("limitLow"),
                limitHigh=display_data.get("limitHigh"),
                description=display_data.get("description"),
                units=display_data.get("units"),
                precision=display_data.get("precision"),
                form=form.get("index") if form else None,
                choices=form.get("choices") if form else None,
            ),
            control=Control(
                limitLow=control_data.get("limitLow"),
                limitHigh=control_data.get("limitHigh"),
                minStep=control_data.get("minStep"),
            ),
            valueAlarm=ValueAlarm(
                active=alarm_data.get("active"),
                lowAlarmLimit=safe_get_nan(alarm_data, "lowAlarmLimit"),
                lowWarningLimit=safe_get_nan(alarm_data, "lowWarningLimit"),
                highWarningLimit=safe_get_nan(alarm_data, "highWarningLimit"),
                highAlarmLimit=safe_get_nan(alarm_data, "highAlarmLimit"),
                lowAlarmSeverity=alarm_data.get("lowAlarmSeverity"),
                lowWarningSeverity=alarm_data.get("lowWarningSeverity"),
                highWarningSeverity=alarm_data.get("highWarningSeverity"),
                highAlarmSeverity=alarm_data.get("highAlarmSeverity"),
                hysteresis=alarm_data.get("hysteresis"),
            ),
        )

    @staticmethod
    def ca_update(pv_obj: dict, pv_name: str) -> PVData:
        value_field = pv_obj.get("value")
        raw_array = dtype = None
        if isinstance(value_field, (list, np.ndarray)):
            raw_array, dtype = encode_array_raw(value_field)
        value = None if raw_array is not None else _normalize_value(value_field)

        timestamp = _normalize_value(pv_obj.get("timestamp", 0.0)) or 0.0
        seconds = int(timestamp)
        return PVData(
            pv=pv_name,
            value=value,
            enumChoices=pv_obj.get("enum_strs"),
            alarm=Alarm(
                severity=_normalize_value(pv_obj.get("severity", 0)),
                status=_normalize_value(pv_obj.get("status", 0)),
                message=str(pv_obj.get("status", "NO_ALARM")),
            ),
            timeStamp=TimeStamp(
                secondsPastEpoch=seconds,
                nanoseconds=int((timestamp - seconds) * 1e9),
            ),
            rawArray=raw_array,
            dtype=dtype,
        )

    @staticmethod
    def snapshot_update(update: PVData) -> dict:
        return {
            "value": update.value,
            "alarm": asdict(update.alarm),
            "timeStamp": asdict(update.timeStamp),
            "b64arr": base64.b64encode(update.rawArray).decode("ascii") if update.rawArray is not None else None,
            "b64dtype": update.dtype,
        }

    @staticmethod
    def ca_metadata(pv_obj: dict) -> PVMetadata:
        return PVMetadata(
            display=Display(
                limitLow=_normalize_value(pv_obj.get("lower_disp_limit")),
                limitHigh=_normalize_value(pv_obj.get("upper_disp_limit")),
                units=pv_obj.get("units"),
                precision=_normalize_value(pv_obj.get("precision")),
            ),
            control=Control(
                limitLow=_normalize_value(pv_obj.get("lower_ctrl_limit")),
                limitHigh=_normalize_value(pv_obj.get("upper_ctrl_limit")),
            ),
            valueAlarm=ValueAlarm(
                lowAlarmLimit=_normalize_value(safe_get_nan(pv_obj, "lower_alarm_limit")),
                highAlarmLimit=_normalize_value(safe_get_nan(pv_obj, "upper_alarm_limit")),
                lowWarningLimit=_normalize_value(safe_get_nan(pv_obj, "lower_warning_limit")),
                highWarningLimit=_normalize_value(safe_get_nan(pv_obj, "upper_warning_limit")),
                hysteresis=_normalize_value(safe_get_nan(pv_obj, "hyst")),
            ),
        )
