// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import type { Point, Size } from "./viewport.ts";

/** Points and distances are in the element's CSS pixels, unaffected by the grid's zoom */
export interface ViewportHandlers {
  /** Size and device pixels per CSS pixel, including the grid's zoom */
  onResize: (view: Size, pixelRatio: number) => void;
  onZoom: (factor: number, point: Point) => void;
  onPan: (dx: number, dy: number) => void;
  onReset: () => void;
  onHover?: (point: Point | null) => void;
}

// Zoom per wheel pixel: one notch (about 100 px) zooms by about 1.2
const ZOOM_PER_PIXEL = 0.0018;
const LINE_PIXELS = 16;

/**
 * Turns pointer and wheel input over `element` into view changes and reports its size and
 * display scale. The wheel zooms the image (not the grid), left-drag pans, double-click resets;
 * the middle button, Alt+left-drag (grid pan) and right-click are left to the grid. The scale is
 * also measured on pointer enter, since the grid zoom (a CSS transform) fires no resize event.
 */
export function attachViewportInput(element: HTMLElement, handlers: ViewportHandlers): () => void {
  let zoom = 1;
  let drag: { id: number; x: number; y: number } | null = null;

  const measure = () => {
    const view = { width: element.offsetWidth, height: element.offsetHeight };
    const rendered = element.getBoundingClientRect().width;
    zoom = view.width > 0 && rendered > 0 ? rendered / view.width : 1;
    handlers.onResize(view, window.devicePixelRatio * zoom);
  };

  const pointOf = (event: MouseEvent): Point => {
    const rect = element.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom };
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

  const onWheel = (event: WheelEvent) => {
    // Over the image, the wheel zooms only the image
    event.preventDefault();
    event.stopPropagation();
    const unit =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? LINE_PIXELS
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? element.offsetHeight
          : 1;
    handlers.onZoom(Math.exp(-event.deltaY * unit * ZOOM_PER_PIXEL), pointOf(event));
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || event.altKey || drag) return;
    event.preventDefault(); // no text selection while dragging
    element.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    element.style.cursor = "grabbing";
  };

  const onPointerMove = (event: PointerEvent) => {
    if (drag?.id === event.pointerId) {
      const dx = (event.clientX - drag.x) / zoom;
      const dy = (event.clientY - drag.y) / zoom;
      drag.x = event.clientX;
      drag.y = event.clientY;
      if (dx || dy) handlers.onPan(dx, dy);
    }
    handlers.onHover?.(pointOf(event));
  };

  const onPointerUp = (event: PointerEvent) => {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    element.style.cursor = "";
  };

  const onPointerLeave = () => {
    if (!drag) handlers.onHover?.(null);
  };

  const onDoubleClick = (event: MouseEvent) => {
    if (event.button === 0) handlers.onReset();
  };

  const observer = new ResizeObserver(measure);
  observer.observe(element);
  window.addEventListener("resize", measure);
  element.addEventListener("pointerenter", measure);
  element.addEventListener("wheel", onWheel, { passive: false });
  element.addEventListener("pointerdown", onPointerDown);
  element.addEventListener("pointermove", onPointerMove);
  element.addEventListener("pointerup", onPointerUp);
  element.addEventListener("pointercancel", onPointerUp);
  element.addEventListener("pointerleave", onPointerLeave);
  element.addEventListener("dblclick", onDoubleClick);
  // One-finger drags pan instead of scrolling the page
  element.style.touchAction = "none";
  watchRatio();
  measure();

  return () => {
    observer.disconnect();
    window.removeEventListener("resize", measure);
    element.removeEventListener("pointerenter", measure);
    element.removeEventListener("wheel", onWheel);
    element.removeEventListener("pointerdown", onPointerDown);
    element.removeEventListener("pointermove", onPointerMove);
    element.removeEventListener("pointerup", onPointerUp);
    element.removeEventListener("pointercancel", onPointerUp);
    element.removeEventListener("pointerleave", onPointerLeave);
    element.removeEventListener("dblclick", onDoubleClick);
    media?.removeEventListener("change", onRatioChange);
    element.style.touchAction = "";
    element.style.cursor = "";
  };
}
