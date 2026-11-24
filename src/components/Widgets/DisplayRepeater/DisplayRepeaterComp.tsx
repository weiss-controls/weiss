// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import React, { useMemo, useRef } from "react";
import type { InstanceEntry, Widget, WidgetUpdate } from "@src/types/widgets";
import { useUIStore } from "@src/stores/uiStore";
import { useEditorStore } from "@src/stores/editorStore";
import {
  applyDisplayLayout,
  assignNewIds,
  computeInstanceCells,
  macrosToKey,
  resolveDisplayMacros,
  type DisplayContent,
} from "@components/Widgets/shared/embeddedContent";
import { useEmbeddedContent } from "@components/Widgets/shared/useEmbeddedContent";
import { Placeholder } from "@components/Widgets/shared/Placeholder";

function normalizeInstances(raw: unknown): InstanceEntry[] {
  return Array.isArray(raw) ? (raw as InstanceEntry[]) : [];
}

/**
 * Embeds the same display once per entry of `instances`, laid out in a grid. Each copy gets the
 * shared macros overridden by its own, and is scaled into its cell keeping its aspect ratio.
 */
const DisplayRepeaterComp: React.FC<WidgetUpdate> = ({ data }) => {
  const inEditMode = useUIStore((s) => s.inEditMode);
  const globalMacros = useEditorStore((s) => s.globalMacros);
  const p = data.editableProperties;

  const sharedMacros = p.macros?.value;
  const instances = useMemo(() => normalizeInstances(p.instances?.value), [p.instances?.value]);
  const x = p.x?.value ?? 0;
  const y = p.y?.value ?? 0;
  const width = p.width?.value ?? 100;
  const height = p.height?.value ?? 70;
  const horizontal = p.horizontal?.value ?? true;
  const gap = Math.max(p.instanceGap?.value ?? 0, 0);
  const wrapCount = Math.max(Math.floor(p.instanceWrapCount?.value ?? 0), 0);

  const cells = useMemo(
    () =>
      computeInstanceCells({ x, y, width, height }, instances.length, horizontal, gap, wrapCount),
    [x, y, width, height, instances.length, horizontal, gap, wrapCount],
  );
  const instanceMacros = useMemo(
    () =>
      instances.map((inst) =>
        resolveDisplayMacros({ ...sharedMacros, ...inst.macros }, globalMacros),
      ),
    [instances, sharedMacros, globalMacros],
  );
  const layoutKey = JSON.stringify([cells, instanceMacros.map((m) => macrosToKey(m.all))]);

  // One copy of the content per instance, each with its own widget ids. Kept across re-layouts so
  // ids stay stable (nested embedding widgets keep their loaded children); rebuilt on re-fetch.
  const copiesRef = useRef<{ content: DisplayContent | null; widgets: Widget[][] }>({
    content: null,
    widgets: [],
  });
  const copyFor = (content: DisplayContent, index: number): DisplayContent => {
    const copies = copiesRef.current;
    if (copies.content !== content) copiesRef.current = { content, widgets: [] };
    const widgets = copiesRef.current.widgets;
    widgets[index] ??= index === 0 ? content.baseWidgets : content.baseWidgets.map(assignNewIds);
    return { ...content, baseWidgets: widgets[index] };
  };

  const resolvedPath = useEmbeddedContent(data.id, p.displayPath?.value, layoutKey, (content) =>
    cells.flatMap((cell, i) => applyDisplayLayout(copyFor(content, i), cell, instanceMacros[i])),
  );

  const hasChildren = (data.children?.length ?? 0) > 0;
  if (hasChildren || !inEditMode) return null;

  const label = resolvedPath ? "Loading…" : "No display selected";
  if (cells.length === 0) return <Placeholder label="No instances" />;
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {cells.map((cell, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: cell.x - x,
            top: cell.y - y,
            width: cell.width,
            height: cell.height,
          }}
        >
          <Placeholder label={i === 0 ? label : `#${i + 1}`} />
        </div>
      ))}
    </div>
  );
};

export { DisplayRepeaterComp };
