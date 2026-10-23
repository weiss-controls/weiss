// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

/** Actions and reactions that span several stores and the WebSocket session. */

import { EDIT_MODE, RUNTIME_MODE, type Mode } from "@src/constants/constants";
import { Roles } from "@src/services/AuthService/AuthService";
import {
  updateStagingRepoFile,
  uploadStagingRepoFile,
  type StagingTreeInfo,
} from "@src/services/APIClient";
import { notifyUser } from "@src/services/Notifications/Notification";
import { usePVStore } from "@src/stores/pvStore";
import { setSubscribedPVs, startNewSession, stopSession } from "@src/services/WSClient/session";
import { collectGlobalMacroOverrides } from "@src/utils/macros";
import { convertDisplay, parsePhoebus } from "@src/utils/bob2json";
import { useEditorStore } from "./editorStore";
import { restoreWidgets } from "./restoreWidgets";
import { serializeWidgets } from "./widgetHelpers";
import { useRepoStore } from "./repoStore";
import { useSessionStore } from "./sessionStore";
import { useUIStore } from "./uiStore";

const AUTO_SAVE_DELAY = 500; //ms

let stopRuleMacroSync: (() => void) | null = null;
let pendingSave: { timer: ReturnType<typeof setTimeout>; save: () => Promise<void> } | null = null;

/** Runs a pending auto-save now. */
function flushAutoSave() {
  if (!pendingSave) return;
  clearTimeout(pendingSave.timer);
  const { save } = pendingSave;
  pendingSave = null;
  void save();
}

/**
 * Saves the edited .opi.json file after a short delay when its content differs from the last
 * loaded or saved content. The pending save keeps the file and content it was scheduled for.
 */
function scheduleAutoSave() {
  const file = useRepoStore.getState().selectedFile;
  const { editorWidgets, savedContent, setSavedContent } = useEditorStore.getState();
  if (pendingSave) clearTimeout(pendingSave.timer);
  pendingSave = null;
  if (!useSessionStore.getState().isDeveloper || !useUIStore.getState().inEditMode) return;
  if (!file?.repo_id || !file.path.toLowerCase().endsWith(".opi.json")) return;
  const content = serializeWidgets(editorWidgets);
  if (content === savedContent) return;

  const save = async () => {
    try {
      const updated = (
        await updateStagingRepoFile({
          path: { repo_id: file.repo_id },
          query: { path: file.path },
          body: { content },
        })
      ).data;
      useRepoStore
        .getState()
        .setReposTreeInfo((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? prev);
      const current = useRepoStore.getState().selectedFile;
      if (current?.repo_id === file.repo_id && current.path === file.path) setSavedContent(content);
    } catch (err) {
      notifyUser(`Failed to save file: ${String(err)}`, "error");
    }
  };
  pendingSave = { timer: setTimeout(flushAutoSave, AUTO_SAVE_DELAY), save };
}

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
  flushAutoSave();
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

const BOB_EXTENSION = /\.bob$/i;

export interface PhoebusImportItem {
  file: File;
  /** Destination path in the repository */
  dest: string;
}

/** Repository path of an imported file: `.bob` files become `.opi.json` files */
export function phoebusImportDest(targetDir: string, relPath: string): string {
  const path = relPath.replace(BOB_EXTENSION, ".opi.json");
  return targetDir ? `${targetDir}/${path}` : path;
}

/**
 * Converts a `.bob` file to `.opi.json` content saved at `dest`, adding conversion messages to
 * `warnings`.
 */
async function convertBobFile(file: File, dest: string, warnings: string[]): Promise<string> {
  const converted = convertDisplay(parsePhoebus(await file.text()), dest);
  warnings.push(...converted.warnings);
  return serializeWidgets(restoreWidgets(converted.widgets, warnings)) + "\n";
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  const detail = (err as { detail?: unknown } | null)?.detail;
  return typeof detail === "string" ? detail : String(err);
}

/**
 * Writes Phoebus files to a staging repository: `.bob` files are converted to `.opi.json`, other
 * files (images) are uploaded as they are. A single imported display is opened in the editor.
 */
export async function importPhoebusFiles(repoId: string, items: PhoebusImportItem[]) {
  flushAutoSave();
  const written: string[] = [];
  const failed: string[] = [];
  const warned: string[] = [];
  let tree: StagingTreeInfo | null = null;

  for (const { file, dest } of items) {
    try {
      const warnings: string[] = [];
      const body = BOB_EXTENSION.test(file.name)
        ? new Blob([await convertBobFile(file, dest, warnings)], { type: "application/json" })
        : file;
      tree = (
        await uploadStagingRepoFile({
          path: { repo_id: repoId },
          query: { path: dest },
          body: { file: body },
        })
      ).data;
      written.push(dest);
      if (warnings.length > 0) warned.push(`${dest}:\n  ${warnings.join("\n  ")}`);
    } catch (err) {
      failed.push(`${dest}: ${errorMessage(err)}`);
    }
  }

  const repo = useRepoStore.getState();
  if (tree) {
    const updated = tree;
    repo.setReposTreeInfo((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? prev);
  }
  const displays = written.filter((p) => p.endsWith(".opi.json"));
  if (displays.length === 1) {
    repo.setSelectedFile({ repo_id: repoId, path: displays[0] });
  } else if (repo.selectedFile?.repo_id === repoId && written.includes(repo.selectedFile.path)) {
    repo.reloadSelectedFile();
  }

  const summary = `Imported ${written.length} of ${items.length} file(s)`;
  if (failed.length > 0) {
    notifyUser(`${summary}. Failed:\n ${failed.join("\n ")}`, "error");
  } else if (warned.length > 0) {
    notifyUser(`${summary}, ${warned.length} with warnings:\n ${warned.join("\n ")}`, "warning");
  } else {
    notifyUser(summary, "success");
  }
}

// Operators only use runtime mode
useSessionStore.subscribe((state, prev) => {
  if (state.user !== prev.user && state.user?.role === Roles.OPERATOR) updateMode(RUNTIME_MODE);
});

useEditorStore.subscribe((state, prev) => {
  if (state.editorWidgets !== prev.editorWidgets || state.savedContent !== prev.savedContent)
    scheduleAutoSave();
});
// Edits made just before switching file are saved to the file they belong to
useRepoStore.subscribe((state, prev) => {
  if (state.selectedFile !== prev.selectedFile) flushAutoSave();
});

// The session subscribes the resolved PVs now if connected, otherwise on connect
setSubscribedPVs(useEditorStore.getState().resolvedPVList);
useEditorStore.subscribe((state, prev) => {
  if (state.resolvedPVList !== prev.resolvedPVList) setSubscribedPVs(state.resolvedPVList);
});
