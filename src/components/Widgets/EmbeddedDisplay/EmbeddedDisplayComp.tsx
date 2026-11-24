// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import React, { useMemo } from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import { useUIStore } from "@src/stores/uiStore";
import { useEditorStore } from "@src/stores/editorStore";
import {
  applyDisplayLayout,
  macrosToKey,
  resolveDisplayMacros,
} from "@components/Widgets/shared/embeddedContent";
import { useEmbeddedContent } from "@components/Widgets/shared/useEmbeddedContent";
import { Placeholder } from "@components/Widgets/shared/Placeholder";

const EmbeddedDisplayComp: React.FC<WidgetUpdate> = ({ data }) => {
  const inEditMode = useUIStore((s) => s.inEditMode);
  const globalMacros = useEditorStore((s) => s.globalMacros);
  const p = data.editableProperties;

  const displayMacros = p.macros?.value;
  const x = p.x?.value ?? 0;
  const y = p.y?.value ?? 0;
  const width = p.width?.value ?? 100;
  const height = p.height?.value ?? 70;

  const macros = useMemo(
    () => resolveDisplayMacros(displayMacros, globalMacros),
    [displayMacros, globalMacros],
  );
  const layoutKey = `${x}|${y}|${width}|${height}|${macrosToKey(macros.all)}`;

  const resolvedPath = useEmbeddedContent(data.id, p.displayPath?.value, layoutKey, (content) =>
    applyDisplayLayout(content, { x, y, width, height }, macros),
  );

  const hasChildren = (data.children?.length ?? 0) > 0;
  if (hasChildren || !inEditMode) return null;
  return <Placeholder label={resolvedPath ? "Loading…" : "No display selected"} />;
};

export { EmbeddedDisplayComp };
