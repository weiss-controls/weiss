# AreaDetector widget

Displays areaDetector images: NTNDArray PVs (PVA), or plain waveform PVs such as `NDStdArrays` (CA
or PVA) with their shape taken from separate PVs. Pixel processing and drawing run in a web worker
per widget; interaction, pixel readout and the colorbar stay on the main thread.

For the conventions to follow when changing this code, see the "AreaDetector (image) widget" section
of [`.github/copilot-instructions.md`](../../../../.github/copilot-instructions.md); for how image
data travels from epicsWS, see
[`docs/src/developer/architecture.md`](../../../../docs/src/developer/architecture.md).

## Data flow

```text
epicsWS ──► useEpicsWS ──► imageStore ──► frameSource ──► AdController ──► ad.worker
                │            (frames)       (events)     (main thread)    (OffscreenCanvas)
                └──► pvStore (summary of the image PV, size and data type PVs)
```

- `useEpicsWS` routes NTNDArray frames, and frames of plain array PVs registered as images, to
  `src/services/imageStore.ts`. Frames never go through React props.
- `frameSource.ts` turns both stores into one stream of events (`frame`, `notImage`, `waiting`,
  `disconnected`) for one PV, adding the waveform shape when waveform mode is configured.
- `AdController` validates each frame, keeps at most one frame in flight and one pending, and copies
  accepted frames to the worker, which renders them onto the widget's canvas.

## Files

Main thread:

| File                   | Contents                                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AreaDetector.ts`      | Widget definition and its default properties.                                                                                                                    |
| `AreaDetectorComp.tsx` | React component: creates the controller at runtime, passes property changes to it, shows status, warning and colorbar; edit-mode preview.                        |
| `adWorkerClient.ts`    | `AdController`: owns the canvas and the worker, bounded frame delivery, view and parameter changes, waveform frames, pixel readout overlay, status (`AdStatus`). |
| `frameSource.ts`       | `storeFrameSource`: frame events from the image and PV stores; registers a plain waveform PV as an image and tracks its shape PVs.                               |
| `workerProtocol.ts`    | Messages between controller and worker.                                                                                                                          |
| `viewport.ts`          | Pure viewport math: fit, zoom, pan, clamping, rotation and flips, view to image mapping, canvas size cap. Also used by the worker.                               |
| `viewportInput.ts`     | Wheel, pointer, double-click and resize handling, and measurement of the display scale (device pixel ratio and grid zoom).                                       |
| `Colorbar.tsx`         | Fixed-width colorbar strip; its labels are updated directly, not through React state.                                                                            |
| `preview.ts`           | Deterministic stand-in image for edit mode, rendered by the same core as live frames.                                                                            |
| `format.ts`            | Number formatting for the readout and colorbar labels.                                                                                                           |
| `index.ts`             | Export for the widget registry.                                                                                                                                  |

`worker/`, the render core. Apart from `ad.worker.ts` these modules are pure (no worker globals) and
also run on the main thread:

| File             | Contents                                                                                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ad.worker.ts`   | Worker shell: keeps the last frame and view, renders frames, redraws on `view`, re-renders on `params`.                                                                                   |
| `imageLayout.ts` | Frame validation and pixel layout (`resolveLayout`), resource limits, `pixelValue`, and `waveformFrame` for plain waveforms.                                                              |
| `intensity.ts`   | Limits (`computeLimits`), linear/log mapping of values to 256 levels.                                                                                                                     |
| `colorMaps.ts`   | Colormaps (grayscale, viridis, inferno, turbo) and their 256-level tables.                                                                                                                |
| `render.ts`      | `renderFrame`: values to RGBA pixels with the rendering parameters; Mono uses limits, scale and colormap; 8-bit RGB is shown as delivered, wider RGB types scaled over the frame's range. |
| `draw.ts`        | `drawView`: draws a rendered image onto any 2D context through the viewport transform.                                                                                                    |

## Controller and worker

- One worker per widget, only at runtime. Each controller creates a fresh canvas and transfers it to
  the worker; teardown terminates the worker and removes the canvas.
- Frame messages (`frame`, `reset`, and the replies `displayed`, `rendered`, `rejected`, `error`)
  carry a `resetCount`, which goes up whenever the image is discarded; replies with an older count
  are ignored.
- `view` (size, pixel ratio, orientation, zoom and pan) and `params` (colormap, limits, scale) carry
  no `resetCount`: the latest one applies and they never discard the image. They are sent at most
  once per animation frame, and before each frame.

## Image sources

- **NTNDArray** (PVA): shape, color mode and codec come with each frame. Mono and RGB1/2/3;
  compressed frames, Bayer and YUV are refused with a message.
- **Plain waveform** (e.g. `<prefix>image1:ArrayData`, CA or PVA): used when the Size X and Size Y
  PV properties are set; Mono only. The optional Data type PV corrects signed/unsigned values and
  warns when the waveform type truncates the data. Shape and frames are not atomic: a mismatch right
  after a size change is skipped, a lasting one is refused.

## Properties

| Group       | Properties                                                                       |
| ----------- | -------------------------------------------------------------------------------- |
| PVs         | `pvName`; `sizeXPV`, `sizeYPV`, `dataTypePV` (waveform only)                     |
| Orientation | `imageRotation`, `imageFlipX`, `imageFlipY`                                      |
| Intensity   | `colorMap`, `autoLimits`, `min`, `max`, `logIntensity`                           |
| Overlays    | `showPixelReadout`, `showColorbar`, `textColor` and `fontSize` (colorbar labels) |

Common layout and style properties apply as for other widgets.
