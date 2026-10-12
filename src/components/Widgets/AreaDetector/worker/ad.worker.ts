// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { renderFrame } from "./render.ts";

// Placeholder shell; the message protocol arrives in the next commit
self.onmessage = () => {
  void renderFrame;
};
