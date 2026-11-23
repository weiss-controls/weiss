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
import { collectGlobalMacroOverrides, composeForwardNavigationMacros } from "@src/utils/macros";
import { resolveRepoPath } from "@src/utils/repoPath";
import { convertDisplay, parsePhoebus } from "@src/utils/bob2json";
import {
  buildFileSearch,
  decodeScreenContext,
  encodeScreenContext,
  isHiddenPath,
  parseFileSearch,
  pendingFileLink,
  type FileLink,
} from "@src/utils/fileUrl";
import { useEditorStore } from "./editorStore";
import { restoreWidgets } from "./restoreWidgets";
import { serializeWidgets } from "./widgetHelpers";
import { restoreLastFile, useRepoStore, type SelectedPathInfo } from "./repoStore";
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
  if (!useSessionStore.getState().isDeveloper) mode = RUNTIME_MODE;
  flushAutoSave();
  const editor = useEditorStore.getState();
  const navMacros = useRepoStore.getState().selectedFile?.macros;
  editor.resetRuntimeMacros(mode === RUNTIME_MODE ? navMacros : undefined);
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

// Operators only use runtime mode; logging out closes the WebSocket session
useSessionStore.subscribe((state, prev) => {
  if (state.user === prev.user) return;
  if (state.user?.role === Roles.OPERATOR) updateMode(RUNTIME_MODE);
  else if (!state.user) {
    stopRuleMacroSync?.();
    stopRuleMacroSync = null;
    stopSession();
  }
});
if (useSessionStore.getState().user?.role === Roles.OPERATOR) updateMode(RUNTIME_MODE);

// Closing, reloading or leaving the page closes the session
// A page restored from the back/forward cache reconnects.
window.addEventListener("pagehide", stopSession);
window.addEventListener("pageshow", (event) => {
  if (event.persisted && !useUIStore.getState().inEditMode) startNewSession();
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

/**
 * Opens a display from the current one (navigation button): the button macros go on top of the
 * macros the current screen was opened with.
 */
export function navigateToDisplay(displayPath: string, buttonMacros: Record<string, string>) {
  const { selectedFile, setSelectedFile } = useRepoStore.getState();
  if (!selectedFile) return;
  const macros = composeForwardNavigationMacros(selectedFile.macros ?? {}, buttonMacros);
  setSelectedFile({
    repo_id: selectedFile.repo_id,
    path: resolveRepoPath(displayPath, selectedFile.path),
    macros: Object.keys(macros).length > 0 ? macros : undefined,
  });
}

// The editor URL shows the selected file, its navigation macros and the mode. It is written once
// the file link of the page load has been applied, after the first repository trees load.
let urlSync: "waiting" | "opening" | "done" = "waiting";
/** Writes in order; each one waits for the context encoding of the previous one */
let urlWrites = Promise.resolve();
/** Context of the selection, reused while the selection is unchanged */
let contextCache: { file: SelectedPathInfo; repo: string; ctx: Promise<string> } | null = null;

function screenContext(file: SelectedPathInfo, repo: string): Promise<string | undefined> {
  if (!file.macros) return Promise.resolve(undefined);
  if (contextCache?.file !== file || contextCache.repo !== repo)
    contextCache = { file, repo, ctx: encodeScreenContext(repo, file.path, file.macros) };
  return contextCache.ctx.catch(() => undefined);
}

/** Writes the selected file, its context and the mode to the URL of the editor page. */
function writeFileUrl(history: "push" | "replace") {
  if (urlSync !== "done") return;
  const { selectedFile, reposTreeInfo } = useRepoStore.getState();
  const repo = reposTreeInfo?.find((r) => r.id === selectedFile?.repo_id)?.alias;
  const { mode } = useUIStore.getState();
  const ctx = selectedFile && repo ? screenContext(selectedFile, repo) : undefined;
  urlWrites = urlWrites.then(async () => {
    if (window.location.pathname !== "/") return;
    const search = buildFileSearch({ repo, path: selectedFile?.path, mode, ctx: await ctx });
    if (search === window.location.search) return;
    const url = `/${search}${window.location.hash}`;
    if (history === "push") window.history.pushState(window.history.state, "", url);
    else window.history.replaceState(window.history.state, "", url);
  });
}

/** Repository file of a link, or null (with an error) when it is unknown, hidden or damaged. */
async function resolveFileLink({ repo, path, ctx }: FileLink): Promise<SelectedPathInfo | null> {
  if (!repo || !path) return null;
  const repoInfo = useRepoStore.getState().reposTreeInfo?.find((r) => r.alias === repo);
  if (!repoInfo) {
    notifyUser(`Repository '${repo}' not found`, "error");
    return null;
  }
  if (!useUIStore.getState().inEditMode && isHiddenPath(path)) {
    notifyUser(`Failed to load file: ${path} not found`, "error");
    return null;
  }
  if (!ctx) return { repo_id: repoInfo.id, path };
  const macros = await decodeScreenContext(ctx, repo, path);
  if (!macros) {
    notifyUser("Failed to load display: invalid link", "error");
    return null;
  }
  const file = { repo_id: repoInfo.id, path, macros };
  // The URL keeps the context it was opened with
  contextCache = { file, repo, ctx: Promise.resolve(ctx) };
  return file;
}

/** Applies the mode and file of the page URL, or restores the last opened file. */
async function openPendingFileLink() {
  urlSync = "opening";
  const link = pendingFileLink();
  // Operators stay in runtime mode
  const canSwitch = useSessionStore.getState().isDeveloper;
  if (canSwitch && link.mode && link.mode !== useUIStore.getState().mode) updateMode(link.mode);
  const file = link.repo || link.path ? await resolveFileLink(link) : undefined;
  urlSync = "done";
  if (file !== undefined) useRepoStore.getState().setSelectedFile(file, "replace");
  else restoreLastFile();
  writeFileUrl("replace");
}

useRepoStore.subscribe((state, prev) => {
  if (state.selectedFile !== prev.selectedFile)
    writeFileUrl(state.selectionNav === "push" ? "push" : "replace");
  if (urlSync === "waiting" && prev.isReposLoading && !state.isReposLoading)
    void openPendingFileLink();
});
useUIStore.subscribe((state, prev) => {
  if (state.mode !== prev.mode) writeFileUrl("replace");
});

// Back/forward opens the file of the history entry; the mode stays as it is
let popRequest = 0;
window.addEventListener("popstate", () => {
  if (urlSync !== "done" || window.location.pathname !== "/") return;
  const request = ++popRequest;
  void resolveFileLink(parseFileSearch(window.location.search)).then((file) => {
    if (request !== popRequest) return;
    useRepoStore.getState().setSelectedFile(file, "pop");
    writeFileUrl("replace");
  });
});
