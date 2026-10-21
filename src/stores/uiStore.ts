// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { EDIT_MODE, type Mode } from "@src/constants/constants";

export const EDITOR_SIDEBAR_DEFAULT_WIDTH = 360;

interface SidebarSnapshot {
  open: boolean;
  pinned: boolean;
}

interface UIStoreState {
  mode: Mode;
  inEditMode: boolean;
  isPanning: boolean;
  /** Id of the TextLabel whose text is being edited on the canvas */
  textEditingId: string | null;
  wdgPickerOpen: boolean;
  editorSidebarOpen: boolean;
  editorSidebarPinned: boolean;
  editorSidebarWidth: number;
  /** Sidebar state before entering runtime mode, restored when returning to edit mode */
  preRuntimeSidebar: SidebarSnapshot | null;
  /** Sets the mode and closes or restores the sidebar and widget picker. */
  setMode: (mode: Mode) => void;
  setIsPanning: (isPanning: boolean) => void;
  setTextEditingId: (id: string | null) => void;
  setWdgPickerOpen: (open: boolean) => void;
  toggleWdgPicker: () => void;
  setEditorSidebarOpen: (open: boolean) => void;
  toggleEditorSidebar: () => void;
  toggleEditorSidebarPinned: () => void;
  setEditorSidebarWidth: (width: number) => void;
}

const largeScreen = window.innerWidth >= 1024;

export const useUIStore = create<UIStoreState>()(
  devtools(
    (set) => ({
      mode: EDIT_MODE,
      inEditMode: true,
      isPanning: false,
      textEditingId: null,
      wdgPickerOpen: false,
      editorSidebarOpen: largeScreen,
      editorSidebarPinned: largeScreen,
      editorSidebarWidth: EDITOR_SIDEBAR_DEFAULT_WIDTH,
      preRuntimeSidebar: null,

      setMode,
      setIsPanning: (isPanning) => set({ isPanning }),
      setTextEditingId: (textEditingId) => set({ textEditingId }),
      setWdgPickerOpen: (wdgPickerOpen) => set({ wdgPickerOpen }),
      toggleWdgPicker: () => set((s) => ({ wdgPickerOpen: !s.wdgPickerOpen })),
      setEditorSidebarOpen: (editorSidebarOpen) => set({ editorSidebarOpen }),
      toggleEditorSidebar: () => set((s) => ({ editorSidebarOpen: !s.editorSidebarOpen })),
      toggleEditorSidebarPinned: () =>
        set((s) => ({ editorSidebarPinned: !s.editorSidebarPinned })),
      setEditorSidebarWidth: (editorSidebarWidth) => set({ editorSidebarWidth }),
    }),
    { name: "uiStore", enabled: import.meta.env.DEV },
  ),
);

function setMode(mode: Mode) {
  const s = useUIStore.getState();
  if (mode === s.mode) return;
  if (mode === EDIT_MODE) {
    const restored = s.preRuntimeSidebar;
    useUIStore.setState({
      mode,
      inEditMode: true,
      preRuntimeSidebar: null,
      ...(restored
        ? { editorSidebarOpen: restored.open, editorSidebarPinned: restored.pinned }
        : {}),
    });
  } else {
    useUIStore.setState({
      mode,
      inEditMode: false,
      wdgPickerOpen: false,
      textEditingId: null,
      preRuntimeSidebar: { open: s.editorSidebarOpen, pinned: s.editorSidebarPinned },
      editorSidebarOpen: false,
      editorSidebarPinned: false,
    });
  }
}
