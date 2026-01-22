from __future__ import annotations
from typing import Optional, List, Union, Any
from dataclasses import dataclass
import math
import base64
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
class EnumT:
    index: Optional[int] = None
    choices: Optional[List[str]] = None


@dataclass
class Display:
    limitLow: Optional[float] = None
    limitHigh: Optional[float] = None
    description: Optional[str] = None
    units: Optional[str] = None
    precision: Optional[int] = None
    form: Optional[EnumT] = None


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
    hysteresis: Optional[int] = None


@dataclass
class PVData:
    pv: Optional[str] = None
    value: Optional[Union[float, int, List[float], List[int], List[str]]] = None
    enumChoices: Optional[List[str]] = None
    alarm: Optional[Alarm] = None
    timeStamp: Optional[TimeStamp] = None
    display: Optional[Display] = None
    control: Optional[Control] = None
    valueAlarm: Optional[ValueAlarm] = None
    b64arr: Optional[str] = None
    b64dtype: Optional[str] = None


def encode_base64_array(array: Union[List, np.ndarray], dtype: str) -> str:
    arr = np.asarray(array, dtype=dtype)
    if not arr.dtype.isnative or arr.dtype.byteorder != "<":
        arr = arr.astype("<" + arr.dtype.str[1:])
    return base64.b64encode(arr.tobytes()).decode("ascii")


def encode_array(arr: Any) -> tuple[Optional[str], Optional[str]]:
    """Returns (b64arr, b64dtype) for numeric arrays."""
    if arr is None:
        return None, None

    arr = np.asarray(arr)
    if arr.size == 0:
        return None, None

    if np.issubdtype(arr.dtype, np.floating):
        return encode_base64_array(arr, "float64"), "float64"

    if np.issubdtype(arr.dtype, np.integer):
        min_val, max_val = arr.min(), arr.max()
        if -128 <= min_val <= max_val <= 127:
            dtype = "int8"
        elif -32768 <= min_val <= max_val <= 32767:
            dtype = "int16"
        else:
            dtype = "int32"
        return encode_base64_array(arr, dtype), dtype

    return None, None


def safe_get_nan(obj, k: str):
    v = obj.get(k)
    return None if isinstance(v, float) and math.isnan(v) else v


class PVParser:
    @staticmethod
    def from_pva(pv_obj, pv_name: Optional[str] = None) -> PVData:
        """Converts a p4p NTValue to PVData."""
        enumChoices = value = b64arr = b64dtype = None

        value_field = pv_obj.get("value")

        if isinstance(value_field, (int, float, str)):
            value = value_field
        elif (
            isinstance(value_field, p4pValue)
            and value_field.has("index")
            and value_field.has("choices")
        ):
            value = value_field.get("index")
            enumChoices = value_field.get("choices")
        elif isinstance(value_field, (list, np.ndarray)):
            b64arr, b64dtype = encode_array(value_field)

        a = pv_obj.get("alarm", {})
        alarm = Alarm(
            severity=a.get("severity", 0),
            status=a.get("status", 0),
        )

        ts = pv_obj.get("timeStamp", {})
        timestamp = TimeStamp(
            secondsPastEpoch=ts.get("secondsPastEpoch", 0),
            nanoseconds=ts.get("nanoseconds", 0),
            userTag=ts.get("userTag", 0),
        )

        d = pv_obj.get("display", {})
        form_obj = d.get("form", {})
        form_enum = EnumT(
            index=form_obj.get("index"),
            choices=form_obj.get("choices"),
        )
        display = Display(
            limitLow=d.get("limitLow"),
            limitHigh=d.get("limitHigh"),
            description=d.get("description"),
            units=d.get("units"),
            precision=d.get("precision"),
            form=form_enum,
        )

        c = pv_obj.get("control", {})
        control = Control(
            limitLow=c.get("limitLow"),
            limitHigh=c.get("limitHigh"),
            minStep=c.get("minStep"),
        )

        va = pv_obj.get("valueAlarm", {})

        value_alarm = ValueAlarm(
            active=va.get("active"),
            lowAlarmLimit=safe_get_nan(va, "lowAlarmLimit"),
            lowWarningLimit=safe_get_nan(va, "lowWarningLimit"),
            highWarningLimit=safe_get_nan(va, "highWarningLimit"),
            highAlarmLimit=safe_get_nan(va, "highAlarmLimit"),
            lowAlarmSeverity=va.get("lowAlarmSeverity"),
            lowWarningSeverity=va.get("lowWarningSeverity"),
            highWarningSeverity=va.get("highWarningSeverity"),
            highAlarmSeverity=va.get("highAlarmSeverity"),
            hysteresis=va.get("hysteresis"),
        )

        return PVData(
            pv=pv_name,
            value=value,
            enumChoices=enumChoices,
            alarm=alarm,
            timeStamp=timestamp,
            display=display,
            control=control,
            valueAlarm=value_alarm,
            b64arr=b64arr,
            b64dtype=b64dtype,
        )

    @staticmethod
    def from_ca(pv_obj: dict, pv_name: str) -> PVData:
        """Converts a dict-based CA response to PVData, ensuring JSON-serializable values."""

        def normalize_value(v):
            """Converts numpy types and arrays to JSON-serializable Python types."""
            if isinstance(v, np.generic):
                return v.item()
            elif isinstance(v, np.ndarray):
                return v.tolist()
            return v

        value = normalize_value(pv_obj.get("value"))

        b64arr, b64dtype = encode_array(value) if isinstance(value, list) else (None, None)

        enumChoices = pv_obj.get("enum_strs")

        alarm = Alarm(
            severity=normalize_value(pv_obj.get("severity", 0)),
            status=normalize_value(pv_obj.get("status", 0)),
            message=str(pv_obj.get("status", "NO_ALARM")),
        )

        ts = normalize_value(pv_obj.get("timestamp", 0.0)) or 0.0
        sec = int(ts)
        nsec = int((ts - sec) * 1e9)
        timestamp = TimeStamp(secondsPastEpoch=sec, nanoseconds=nsec)

        display = Display(
            limitLow=normalize_value(pv_obj.get("lower_disp_limit")),
            limitHigh=normalize_value(pv_obj.get("upper_disp_limit")),
            units=pv_obj.get("units"),
            precision=normalize_value(pv_obj.get("precision")),
        )

        control = Control(
            limitLow=normalize_value(pv_obj.get("lower_ctrl_limit")),
            limitHigh=normalize_value(pv_obj.get("upper_ctrl_limit")),
        )

        value_alarm = ValueAlarm(
            lowAlarmLimit=normalize_value(safe_get_nan(pv_obj, "lower_alarm_limit")),
            highAlarmLimit=normalize_value(safe_get_nan(pv_obj, "upper_alarm_limit")),
            lowWarningLimit=normalize_value(safe_get_nan(pv_obj, "lower_warning_limit")),
            highWarningLimit=normalize_value(safe_get_nan(pv_obj, "upper_warning_limit")),
            hysteresis=normalize_value(safe_get_nan(pv_obj, "hyst")),
        )

        return PVData(
            pv=pv_name,
            value=value,
            enumChoices=enumChoices,
            alarm=alarm,
            timeStamp=timestamp,
            display=display,
            control=control,
            valueAlarm=value_alarm,
            b64arr=b64arr,
            b64dtype=b64dtype,
        )
