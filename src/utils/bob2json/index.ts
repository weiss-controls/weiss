// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

/**
 * Public API for the Phoebus .bob -> WEISS .opi.json converter.
 */

export { parsePhoebus, PhoebusParseError } from "./parser";
export { convertDisplay } from "./converter";
export type { ConversionResult } from "./converter";
