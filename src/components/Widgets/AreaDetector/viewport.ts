// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

export type Rotation = 0 | 90 | 180 | 270;

/** Flips are applied in image coordinates, then the image is rotated clockwise */
export interface Orientation {
  rotation: Rotation;
  flipX: boolean;
  flipY: boolean;
}

/**
 * Zoom is relative to fit (1 = fit). The centre is the image point shown in the middle of the
 * view, normalised to 0..1 over the original image, so one state applies to any image size.
 */
export interface ViewState {
  zoom: number;
  centerX: number;
  centerY: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export const NO_ORIENTATION: Orientation = { rotation: 0, flipX: false, flipY: false };
export const FIT: ViewState = { zoom: 1, centerX: 0.5, centerY: 0.5 };

/** Largest zoom, in view (CSS) pixels per image pixel, unless fit is already larger */
export const MAX_PIXEL_SCALE = 64;
const MAX_CANVAS_SIDE = 8192;
const MAX_CANVAS_PIXELS = 16 * 1024 * 1024;

/** Image to view mapping for a valid view: `[a, b, c, d, e, f]` as in `setTransform` */
export interface ResolvedView {
  /** State after clamping */
  state: ViewState;
  /** View pixels per image pixel */
  scale: number;
  matrix: [number, number, number, number, number, number];
}

// Rotation then flip as a matrix with entries 0/±1: [m00, m01, m10, m11]. Its inverse is its
// transpose.
function orientationMatrix({
  rotation,
  flipX,
  flipY,
}: Orientation): [number, number, number, number] {
  const fx = flipX ? -1 : 1;
  const fy = flipY ? -1 : 1;
  switch (rotation) {
    case 0:
      return [fx, 0, 0, fy];
    case 90:
      return [0, -fy, fx, 0];
    case 180:
      return [-fx, 0, 0, -fy];
    case 270:
      return [0, fy, -fx, 0];
  }
}

function orientedSize(image: Size, orientation: Orientation): Size {
  return orientation.rotation % 180 === 0 ? image : { width: image.height, height: image.width };
}

function fitScale(view: Size, image: Size, orientation: Orientation): number {
  const oriented = orientedSize(image, orientation);
  return Math.min(view.width / oriented.width, view.height / oriented.height);
}

function isValid(view: Size, image: Size): boolean {
  return view.width > 0 && view.height > 0 && image.width > 0 && image.height > 0;
}

/** Keeps the zoom in range and the image edges from passing the view edges */
function clamp(view: Size, image: Size, orientation: Orientation, state: ViewState): ViewState {
  const fit = fitScale(view, image, orientation);
  const zoom = Math.min(Math.max(state.zoom, 1), Math.max(1, MAX_PIXEL_SCALE / fit));
  const scale = fit * zoom;
  const oriented = orientedSize(image, orientation);
  const [m00, m01, m10, m11] = orientationMatrix(orientation);

  // Offset of the centre from the image middle, in oriented image pixels
  const dx = (state.centerX - 0.5) * image.width;
  const dy = (state.centerY - 0.5) * image.height;
  const limitX = Math.max(0, (oriented.width - view.width / scale) / 2);
  const limitY = Math.max(0, (oriented.height - view.height / scale) / 2);
  const ox = Math.min(Math.max(m00 * dx + m01 * dy, -limitX), limitX);
  const oy = Math.min(Math.max(m10 * dx + m11 * dy, -limitY), limitY);

  return {
    zoom,
    centerX: 0.5 + (m00 * ox + m10 * oy) / image.width,
    centerY: 0.5 + (m01 * ox + m11 * oy) / image.height,
  };
}

/** Clamped state and image to view transform, or null when the view or the image is empty */
export function resolveView(
  view: Size,
  image: Size,
  orientation: Orientation,
  state: ViewState,
): ResolvedView | null {
  if (!isValid(view, image)) return null;
  const clamped = clamp(view, image, orientation, state);
  const scale = fitScale(view, image, orientation) * clamped.zoom;
  const [m00, m01, m10, m11] = orientationMatrix(orientation);
  const [a, c, b, d] = [m00 * scale, m01 * scale, m10 * scale, m11 * scale];
  const cx = clamped.centerX * image.width;
  const cy = clamped.centerY * image.height;
  return {
    state: clamped,
    scale,
    matrix: [a, b, c, d, view.width / 2 - (a * cx + c * cy), view.height / 2 - (b * cx + d * cy)],
  };
}

/** Image coordinates (continuous, in pixels) of a view point */
function toImage(
  resolved: ResolvedView,
  view: Size,
  image: Size,
  point: Point,
  orientation: Orientation,
): Point {
  const [m00, m01, m10, m11] = orientationMatrix(orientation);
  const vx = (point.x - view.width / 2) / resolved.scale;
  const vy = (point.y - view.height / 2) / resolved.scale;
  return {
    x: resolved.state.centerX * image.width + m00 * vx + m10 * vy,
    y: resolved.state.centerY * image.height + m01 * vx + m11 * vy,
  };
}

/** Zooms by `factor`, keeping the image point under `point` (view pixels) in place */
export function zoomAt(
  view: Size,
  image: Size,
  orientation: Orientation,
  state: ViewState,
  factor: number,
  point: Point,
): ViewState {
  const resolved = resolveView(view, image, orientation, state);
  if (!resolved) return state;
  const anchor = toImage(resolved, view, image, point, orientation);
  const zoom = clamp(view, image, orientation, {
    ...resolved.state,
    zoom: state.zoom * factor,
  }).zoom;
  const scale = fitScale(view, image, orientation) * zoom;
  const [m00, m01, m10, m11] = orientationMatrix(orientation);
  const vx = (point.x - view.width / 2) / scale;
  const vy = (point.y - view.height / 2) / scale;
  return clamp(view, image, orientation, {
    zoom,
    centerX: (anchor.x - (m00 * vx + m10 * vy)) / image.width,
    centerY: (anchor.y - (m01 * vx + m11 * vy)) / image.height,
  });
}

/** Moves the image by `dx`, `dy` view pixels */
export function panBy(
  view: Size,
  image: Size,
  orientation: Orientation,
  state: ViewState,
  dx: number,
  dy: number,
): ViewState {
  const resolved = resolveView(view, image, orientation, state);
  if (!resolved) return state;
  const centre = toImage(
    resolved,
    view,
    image,
    { x: view.width / 2 - dx, y: view.height / 2 - dy },
    orientation,
  );
  return clamp(view, image, orientation, {
    zoom: resolved.state.zoom,
    centerX: centre.x / image.width,
    centerY: centre.y / image.height,
  });
}

/** Array indices of the image pixel under a view point, or null outside the image */
export function viewToImage(
  view: Size,
  image: Size,
  orientation: Orientation,
  state: ViewState,
  point: Point,
): Point | null {
  const resolved = resolveView(view, image, orientation, state);
  if (!resolved) return null;
  const { x, y } = toImage(resolved, view, image, point, orientation);
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return null;
  return { x: Math.floor(x), y: Math.floor(y) };
}

/** Lowers a device pixel ratio so the view's canvas stays within browser limits */
export function capPixelRatio(view: Size, ratio: number): number {
  if (!(view.width > 0 && view.height > 0)) return ratio;
  return Math.min(
    ratio,
    MAX_CANVAS_SIDE / view.width,
    MAX_CANVAS_SIDE / view.height,
    Math.sqrt(MAX_CANVAS_PIXELS / (view.width * view.height)),
  );
}
