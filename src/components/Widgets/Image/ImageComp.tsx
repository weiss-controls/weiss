// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favotto

import React, { useEffect, useState } from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import { useUIContext } from "@src/context/useUIContext";
import { getDeployedRepoFile, getStagingRepoFile } from "@src/services/APIClient";

const MIME_MAP: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function buildDataUrl(path: string, content: string, encoding: string): string {
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  const mime = MIME_MAP[ext] ?? "application/octet-stream";
  if (encoding === "base64") {
    return `data:${mime};base64,${content}`;
  }
  // SVG / plain text — encode as URI
  return `data:${mime};charset=utf-8,${encodeURIComponent(content)}`;
}

const Placeholder: React.FC<{ label?: string }> = ({ label }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      color: "#888",
      fontSize: 12,
      border: "1px dashed #888",
      boxSizing: "border-box",
    }}
  >
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
    <span>{label ?? "No image"}</span>
  </div>
);

const ImageComp: React.FC<WidgetUpdate> = ({ data }) => {
  const { isDeveloper, selectedFile } = useUIContext();
  const p = data.editableProperties;

  const repoId = selectedFile?.repo_id ?? "";
  const imagePath = p.imagePath?.value;
  const objectFit = p.keepAspectRatio?.value ? "contain" : "fill";

  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!repoId || !imagePath) {
      setSrc(null);
      setError(false);
      return;
    }

    let cancelled = false;
    setError(false);

    const fetchImage = async () => {
      try {
        const response = isDeveloper
          ? await getStagingRepoFile({ path: { repo_id: repoId }, query: { path: imagePath } })
          : await getDeployedRepoFile({ path: { repo_id: repoId }, query: { path: imagePath } });

        if (cancelled) return;

        const { content, encoding } = response.data;
        setSrc(buildDataUrl(imagePath, content, encoding ?? "utf-8"));
      } catch {
        if (!cancelled) setError(true);
      }
    };

    void fetchImage();
    return () => {
      cancelled = true;
    };
  }, [repoId, imagePath, isDeveloper]);

  if (!p.visible?.value) return null;

  return (
    <div
      title={p.tooltip?.value ?? ""}
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        backgroundColor: p.backgroundColor?.value,
        borderRadius: p.borderRadius?.value,
        borderStyle: p.borderStyle?.value,
        borderWidth: p.borderWidth?.value,
        borderColor: p.borderColor?.value,
        overflow: "hidden",
      }}
    >
      {src && !error ? (
        <img
          src={src}
          alt={imagePath}
          style={{
            width: "100%",
            height: "100%",
            objectFit: objectFit,
          }}
          draggable={false}
        />
      ) : (
        <Placeholder label={error ? "Failed to load" : undefined} />
      )}
    </div>
  );
};

export { ImageComp };
