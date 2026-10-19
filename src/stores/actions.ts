// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

/** Actions and reactions that span several stores and the WebSocket session. */

import { EDIT_MODE, type Mode } from "@src/constants/constants";
import { usePVStore } from "@src/services/pvStore";
import { setSubscribedPVs, startNewSession, stopSession } from "@src/services/WSClient/session";
import { collectGlobalMacroOverrides } from "@src/utils/macros";
import { useEditorStore } from "./editorStore";
import { useUIStore } from "./uiStore";

let stopRuleMacroSync: (() => void) | null = null;

/** Keeps the rule-driven macro overrides in sync with live PV data (runtime only). */
function startRuleMacroSync() {
  let lastJson = "";
  stopRuleMacroSync = usePVStore.subscribe((state) => {
    const { editorWidgets, runtimeBaseMacros, setRuleMacroOverrides } = useEditorStore.getState();
    const overrides = collectGlobalMacroOverrides(editorWidgets, state.pvs, runtimeBaseMacros);
    const json = JSON.stringify(overrides);
    if (json === lastJson) return;
    lastJson = json;
    setRuleMacroOverrides(overrides);
  });
}

/**
 * Switches between edit and runtime mode: runtime macro layers, edit-mode macro snapshot,
 * selection, WebSocket session and rule-macro sync.
 */
export function updateMode(mode: Mode) {
  const editor = useEditorStore.getState();
  editor.resetRuntimeMacros();
  stopRuleMacroSync?.();
  stopRuleMacroSync = null;
  if (mode === EDIT_MODE) {
    editor.restoreEditModeMacros();
    stopSession();
  } else {
    editor.snapshotEditModeMacros();
    editor.setSelectedWidgetIDs([]);
    startNewSession();
    startRuleMacroSync();
  }
  useUIStore.getState().setMode(mode);
}

// The session subscribes the resolved PVs now if connected, otherwise on connect
setSubscribedPVs(useEditorStore.getState().resolvedPVList);
useEditorStore.subscribe((state, prev) => {
  if (state.resolvedPVList !== prev.resolvedPVList) setSubscribedPVs(state.resolvedPVList);
});
