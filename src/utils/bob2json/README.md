# Phoebus `.bob` → WEISS `.opi.json` converter

Converts a Phoebus Display Builder XML file (`.bob`) into the WEISS widget array format
(`.opi.json`).

## Pipeline

```
.bob XML string
   └─ parsePhoebus()   →  PhoebusDisplay IR   (parser.ts)
   └─ convertDisplay() →  ExportedWidget[]    (converter.ts)
        └─ JSON.stringify → .opi.json
```

1. **`parsePhoebus(xml)`** — parses raw XML into a `PhoebusDisplay` intermediate representation:
   typed structs for colors, fonts, states, and a recursive `PhoebusWidget` tree.
2. **`convertDisplay(display)`** — walks the IR and maps each widget to its WEISS equivalent using
   `WIDGET_MAP` (mapping.ts). Returns `{ widgets, warnings }`. Unsupported widget types are replaced
   with a visible placeholder. Warnings are human-readable strings describing anything that could
   not be mapped.

The public entry point is the barrel (`index.ts`):

```ts
import { parsePhoebus, convertDisplay } from "@src/utils/bob2json";
```

---

## Widget support

| Phoebus type                          | WEISS widget        | Status                                                |
| ------------------------------------- | ------------------- | ----------------------------------------------------- |
| `label`                               | `TextLabel`         | ✅                                                    |
| `textupdate`                          | `TextUpdate`        | ✅                                                    |
| `textentry`                           | `InputField`        | ✅                                                    |
| `action_button`                       | `ActionButton`      | ✅                                                    |
| `bool_button`                         | `ToggleButton`      | ✅                                                    |
| `combo`                               | `SelectionBox`      | ✅                                                    |
| `spinner`                             | `Spinner`           | ✅                                                    |
| `scaledslider`                        | `Slider`            | ✅                                                    |
| `led`                                 | `BitIndicator`      | ✅                                                    |
| `multi_state_led`                     | `MultiStateLED`     | ✅                                                    |
| `byte_monitor`                        | `MultiBitIndicator` | ✅                                                    |
| `progressbar`                         | `ProgressBar`       | ✅                                                    |
| `rectangle`                           | `Rectangle`         | ✅                                                    |
| `ellipse`                             | `Ellipse`           | ✅                                                    |
| `picture`                             | `Image`             | ✅                                                    |
| `embedded`                            | `EmbeddedDisplay`   | ✅ `.bob` path rewritten to `.opi.json`               |
| `group`                               | `Group`             | ✅                                                    |
| `xyplot`                              | `GraphXY`           | 🔶 layout only — `pvNames`/`lineColors` not converted |
| `stripchart`                          | `GraphY`            | 🔶 layout only — `pvNames`/`lineColors` not converted |
| `checkbox`                            | —                   | 🔶 not implemented                                    |
| `choice`                              | —                   | 🔶 not implemented                                    |
| `meter`                               | —                   | 🔶 not implemented                                    |
| `linearmeter`                         | —                   | 🔶 not implemented                                    |
| `tank`                                | —                   | 🔶 not implemented                                    |
| `thermometer`                         | —                   | 🔶 not implemented                                    |
| `array`                               | —                   | 🔶 not implemented                                    |
| `image`                               | —                   | 🔶 not implemented                                    |
| `tabs` / `navtabs`                    | —                   | 🔶 not implemented                                    |
| `slide_button`                        | —                   | 🔶 not implemented                                    |
| `thumbwheel`                          | —                   | 🔶 not implemented                                    |
| `radio`                               | —                   | 🔶 not implemented                                    |
| `table`                               | —                   | 🔶 not implemented                                    |
| `polyline`                            | —                   | 🔶 not implemented                                    |
| `template`                            | —                   | 🔶 not implemented                                    |
| `3d viewer`                           | —                   | 🔶 not implemented                                    |
| `fileselector`                        | —                   | ❌ won't implement                                    |
| `text-symbol`                         | —                   | ❌ won't implement                                    |
| `symbol`                              | —                   | ❌ won't implement                                    |
| `scrollbar`                           | —                   | ❌ won't implement                                    |
| `databrowser` / `waterfallplotwidget` | —                   | ❌ won't implement                                    |
| `arc`                                 | —                   | ❌ won't implement                                    |
| `polygon`                             | —                   | ❌ won't implement                                    |
| `webbrowser`                          | —                   | ❌ won't implement                                    |

---

## Feature support

| Feature                                              | Status             |
| ---------------------------------------------------- | ------------------ |
| Position & size                                      | ✅                 |
| Colors (background, foreground, border, on/off/line) | ✅                 |
| Font (family, size, bold, italic)                    | ✅                 |
| Text alignment (horizontal & vertical)               | ✅                 |
| Visibility                                           | ✅                 |
| Tooltip                                              | ✅                 |
| Transparent background                               | ✅                 |
| Display macros                                       | ✅                 |
| Grid settings (color, visibility, step)              | ✅                 |
| Embedded display path (`.bob` → `.opi.json`)         | ✅                 |
| Multi-state LED states (value, color, label)         | ✅                 |
| Actions                                              | 🔶 not implemented |
| Rules                                                | 🔶 not implemented |
| Plot PV names & line colors                          | 🔶 not implemented |
| Tab pane content                                     | 🔶 not implemented |
| Points (polyline / line drawing)                     | 🔶 not implemented |
| Scripts                                              | ❌ won't implement |
| Points (polygon geometry)                            | ❌ won't implement |

---

## Adding a widget

1. Add the Phoebus type string to `PhoebusWidgetType` in `constants.ts` if missing.
2. Add a `WidgetMapEntry` to `WIDGET_MAP` in `mapping.ts`, mapping Phoebus property keys to WEISS
   property keys.
3. Set `hasFont: true` if the widget should inherit font properties.
4. Add default sizes to `PHOEBUS_DEFAULT_SIZES` in `constants.ts` if the widget can appear without
   explicit width/height.
