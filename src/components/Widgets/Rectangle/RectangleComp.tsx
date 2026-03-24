// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

// Rectangle.tsx
import React from "react";
import type { WidgetUpdate } from "@src/types/widgets";

const RectangleComp: React.FC<WidgetUpdate> = ({ data }) => {
  const p = data.editableProperties;
  if (!p.visible?.value) return null;

  return (
    <div
      title={p.tooltip?.value ?? ""}
      className="rectangle"
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        backgroundColor: p.backgroundColor?.value,
        borderRadius: p.borderRadius?.value,
        borderStyle: p.borderStyle?.value,
        borderWidth: p.borderWidth?.value,
        borderColor: p.borderColor?.value,
      }}
    />
  );
};

export { RectangleComp };
