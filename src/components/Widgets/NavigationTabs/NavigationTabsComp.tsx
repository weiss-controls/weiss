// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import type { TabEntry, WidgetUpdate } from "@src/types/widgets";
import { useUIContext } from "@src/context/useUIContext";
import { useWidgetContext } from "@src/context/useWidgetContext";
import { resolveRepoPath } from "@src/utils/repoPath";
import {
  applyDisplayLayout,
  fetchDisplayContent,
  macrosToKey,
  resolveDisplayMacros,
  type DisplayContent,
  type TargetBox,
} from "@components/Widgets/shared/embeddedContent";
import { COLORS } from "@src/constants/constants";

function normalizeTabs(raw: unknown): TabEntry[] {
  if (!Array.isArray(raw) || raw.length === 0)
    return [{ label: "Tab 1", displayPath: "", macros: {} }];
  return raw as TabEntry[];
}

const NavigationTabsComp: React.FC<WidgetUpdate> = ({ data }) => {
  const { isDeveloper, selectedFile } = useUIContext();
  const { updateWidgetChildren, fileLoadedTrig, globalMacros } = useWidgetContext();
  const p = data.editableProperties;

  const tabs = useMemo(() => normalizeTabs(p.tabs?.value), [p.tabs?.value]);
  const orientation = p.tabOrientation?.value ?? "horizontal";
  const isVertical = orientation === "vertical";
  const tabBarSize = isVertical ? 80 : 40;

  const x = p.x?.value ?? 0;
  const y = p.y?.value ?? 0;
  const width = p.width?.value ?? 100;
  const height = p.height?.value ?? 70;

  const backgroundColor = p.backgroundColor?.value;
  const activeTabColor = p.activeTabColor?.value ?? COLORS.midDarkBlue;
  const textColor = p.textColor?.value;
  const fontSize = p.fontSize?.value;
  const fontFamily = p.fontFamily?.value;
  const fontBold = p.fontBold?.value;
  const fontItalic = p.fontItalic?.value;

  const [activeTab, setActiveTab] = useState(0);
  useEffect(() => {
    setActiveTab((prev) => Math.min(prev, tabs.length - 1));
  }, [tabs.length]);

  const repoId = selectedFile?.repo_id ?? "";
  const opiPath = selectedFile?.path ?? "";

  const activeEntry = tabs[activeTab];
  const displayPath = activeEntry?.displayPath;
  const resolvedPath = displayPath ? resolveRepoPath(displayPath, opiPath) : undefined;

  const contentBox: TargetBox = isVertical
    ? { x: x + tabBarSize, y, width: Math.max(width - tabBarSize, 0), height }
    : { x, y: y + tabBarSize, width, height: Math.max(height - tabBarSize, 0) };

  const resolvedMacros = useMemo(
    () => resolveDisplayMacros(activeEntry?.macros, globalMacros),
    [activeEntry?.macros, globalMacros],
  );
  const resolvedMacroKey = useMemo(() => macrosToKey(resolvedMacros), [resolvedMacros]);

  // Stable ref so effects never need `updateWidgetChildren` directly in their
  // dependency array (see EmbeddedDisplayComp for the same pattern/rationale).
  const updateChildrenRef = useRef(updateWidgetChildren);
  updateChildrenRef.current = updateWidgetChildren;

  const rawContentRef = useRef<DisplayContent | null>(null);
  const lastAppliedLayoutKeyRef = useRef<string>("");
  const macrosRef = useRef<Record<string, string>>({});
  macrosRef.current = resolvedMacros;

  const layoutAndApply = useCallback(() => {
    const cached = rawContentRef.current;
    if (!cached) return;

    const macroKey = macrosToKey(macrosRef.current);
    const layoutKey = `${contentBox.width}|${contentBox.height}|${contentBox.x}|${contentBox.y}|${macroKey}`;
    if (layoutKey === lastAppliedLayoutKeyRef.current) return;

    lastAppliedLayoutKeyRef.current = layoutKey;
    const withMacros = applyDisplayLayout(cached, contentBox, macrosRef.current);
    updateChildrenRef.current(data.id, withMacros, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.id, contentBox.x, contentBox.y, contentBox.width, contentBox.height]);

  // Fetch effect: re-runs when the active tab's source or file-load mode changes.
  // Network requests are shared across instances/tabs via the shared content cache.
  useEffect(() => {
    if (!repoId || !resolvedPath) {
      rawContentRef.current = null;
      lastAppliedLayoutKeyRef.current = "";
      updateChildrenRef.current(data.id, [], false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const content = await fetchDisplayContent(
          repoId,
          resolvedPath,
          isDeveloper,
          fileLoadedTrig,
        );
        if (cancelled) return;

        rawContentRef.current = content;
        lastAppliedLayoutKeyRef.current = "";
        layoutAndApply();
      } catch {
        if (!cancelled) {
          rawContentRef.current = null;
          lastAppliedLayoutKeyRef.current = "";
          updateChildrenRef.current(data.id, [], false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
    // layoutAndApply intentionally omitted: it's re-created on box resize, which
    // must not re-trigger a full re-fetch. The layout effect below handles that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId, resolvedPath, isDeveloper, fileLoadedTrig, data.id]);

  // Macro edits are instance-local and should not trigger a re-fetch.
  useEffect(() => {
    lastAppliedLayoutKeyRef.current = "";
    layoutAndApply();
  }, [resolvedMacroKey, layoutAndApply]);

  // Re-layout (no network) whenever this instance's own box changes.
  useEffect(() => {
    layoutAndApply();
  }, [layoutAndApply]);

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
        backgroundColor,
        borderRadius: p.borderRadius?.value,
        borderStyle: p.borderStyle?.value,
        borderWidth: p.borderWidth?.value,
        borderColor: p.borderColor?.value,
        boxSizing: "border-box",
      }}
    >
      <Tabs
        orientation={isVertical ? "vertical" : "horizontal"}
        variant="scrollable"
        scrollButtons={false}
        value={activeTab}
        onChange={(_, newValue: number) => setActiveTab(newValue)}
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          ...(isVertical
            ? { width: tabBarSize, height: "100%", borderRight: 1 }
            : { height: tabBarSize, width: "100%", borderBottom: 1 }),
          borderColor: "divider",
          "& .MuiTabs-indicator": {
            backgroundColor: activeTabColor,
          },
          "& .MuiTab-root": {
            color: textColor,
            fontSize,
            fontFamily,
            fontWeight: fontBold ? "bold" : "normal",
            fontStyle: fontItalic ? "italic" : "normal",
            minHeight: isVertical ? undefined : tabBarSize,
          },
        }}
      >
        {tabs.map((tab, index) => (
          <Tab
            key={index}
            label={tab.label || `Tab ${index + 1}`}
            sx={{ "&.Mui-selected": { color: activeTabColor } }}
          />
        ))}
      </Tabs>
      {/* Active tab's content is injected as `data.children` and rendered separately by WidgetRenderer. */}
    </Box>
  );
};

export { NavigationTabsComp };
