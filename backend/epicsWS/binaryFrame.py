# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 André Favoto

import json
import struct


def build_binary_frame(json_header: dict, raw_bytes: bytes, dtype_size: int) -> bytes:
    if dtype_size not in (1, 2, 4, 8) or len(raw_bytes) % dtype_size:
        raise ValueError("Invalid array element size or payload length")

    header = json.dumps(json_header, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    header += b" " * (-(4 + len(header)) % dtype_size)
    return struct.pack("<I", len(header)) + header + raw_bytes
