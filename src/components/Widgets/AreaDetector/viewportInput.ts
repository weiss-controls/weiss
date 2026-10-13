// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { Size } from "./viewport.ts";

export interface ViewportHandlers {
  /** Size in CSS pixels and device pixels per CSS pixel, including the grid's zoom */
  onResize: (view: Size, pixelRatio: number) => void;
}

/**
 * Reports the size and display scale of `element`. The grid zooms with a CSS transform, which
 * no resize event reports, so the scale is also re-measured whenever the pointer enters.
 */
export function attachViewportInput(element: HTMLElement, handlers: ViewportHandlers): () => void {
  const measure = () => {
    const view = { width: element.offsetWidth, height: element.offsetHeight };
    const rendered = element.getBoundingClientRect().width;
    const zoom = view.width > 0 && rendered > 0 ? rendered / view.width : 1;
    handlers.onResize(view, window.devicePixelRatio * zoom);
  };

  // A device pixel ratio change (e.g. another monitor) does not always fire a resize
  let media: MediaQueryList | null = null;
  const watchRatio = () => {
    media?.removeEventListener("change", onRatioChange);
    media = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    media.addEventListener("change", onRatioChange);
  };
  const onRatioChange = () => {
    watchRatio();
    measure();
  };

  const observer = new ResizeObserver(measure);
  observer.observe(element);
  window.addEventListener("resize", measure);
  element.addEventListener("pointerenter", measure);
  watchRatio();
  measure();

  return () => {
    observer.disconnect();
    window.removeEventListener("resize", measure);
    element.removeEventListener("pointerenter", measure);
    media?.removeEventListener("change", onRatioChange);
  };
}
