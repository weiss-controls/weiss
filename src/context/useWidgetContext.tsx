// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { useEditorStore } from "@src/stores/editorStore";

/** The whole editor store; re-renders on every change. Being replaced by narrow selectors. */
export const useWidgetContext = () => useEditorStore();
