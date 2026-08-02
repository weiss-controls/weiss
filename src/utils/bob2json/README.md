# Phoebus `.bob` -> WEISS `.opi.json` converter

Converts Phoebus Display Builder XML files (`.bob`) into WEISS widget arrays (`.opi.json`).

---

## Widget support

| Phoebus type                          | WEISS widget                        | Status                                                | or an actual pv name. |
| ------------------------------------- | ----------------------------------- | ----------------------------------------------------- | --------------------- |
| `label`                               | `TextLabel`                         | ✅                                                    |
| `textupdate`                          | `TextUpdate`                        | ✅                                                    |
| `textentry`                           | `InputField`                        | ✅                                                    |
| `action_button`                       | `ActionButton` / `NavigationButton` | ✅ map based on action type                           |
| `bool_button`                         | `ToggleButton`                      | ✅                                                    |
| `combo`                               | `SelectionBox`                      | ✅                                                    |
| `spinner`                             | `Spinner`                           | ✅                                                    |
| `scaledslider`                        | `Slider`                            | ✅                                                    |
| `led`                                 | `BitIndicator`                      | ✅                                                    |
| `multi_state_led`                     | `MultiStateLED`                     | ✅                                                    |
| `byte_monitor`                        | `MultiBitIndicator`                 | ✅                                                    |
| `progressbar`                         | `ProgressBar`                       | ✅                                                    |
| `rectangle`                           | `Rectangle`                         | ✅                                                    |
| `ellipse`                             | `Ellipse`                           | ✅                                                    |
| `picture`                             | `Image`                             | ✅                                                    |
| `embedded`                            | `EmbeddedDisplay`                   | ✅ `.bob` path rewritten to `.opi.json`               |
| `group`                               | `Group`                             | ✅                                                    |
| `xyplot`                              | `GraphXY`                           | 🔶 layout only — `pvNames`/`lineColors` not converted |
| `stripchart`                          | `GraphY`                            | 🔶 layout only — `pvNames`/`lineColors` not converted |
| `checkbox`                            | —                                   | 🔶 not implemented                                    |
| `choice`                              | —                                   | 🔶 not implemented                                    |
| `meter`                               | —                                   | 🔶 not implemented                                    |
| `linearmeter`                         | —                                   | 🔶 not implemented                                    |
| `tank`                                | —                                   | 🔶 not implemented                                    |
| `thermometer`                         | —                                   | 🔶 not implemented                                    |
| `array`                               | —                                   | 🔶 not implemented                                    |
| `image`                               | —                                   | 🔶 not implemented                                    |
| `tabs` / `navtabs`                    | —                                   | 🔶 not implemented                                    |
| `slide_button`                        | —                                   | 🔶 not implemented                                    |
| `thumbwheel`                          | —                                   | 🔶 not implemented                                    |
| `radio`                               | —                                   | 🔶 not implemented                                    |
| `table`                               | —                                   | 🔶 not implemented                                    |
| `polyline`                            | —                                   | 🔶 not implemented                                    |
| `template`                            | —                                   | 🔶 not implemented                                    |
| `3d viewer`                           | —                                   | 🔶 not implemented                                    |
| `fileselector`                        | —                                   | ❌ won't implement                                    |
| `text-symbol`                         | —                                   | ❌ won't implement                                    |
| `symbol`                              | —                                   | ❌ won't implement                                    |
| `scrollbar`                           | —                                   | ❌ won't implement                                    |
| `databrowser` / `waterfallplotwidget` | —                                   | ❌ won't implement                                    |
| `arc`                                 | —                                   | ❌ won't implement                                    |
| `polygon`                             | —                                   | ❌ won't implement                                    |
| `webbrowser`                          | —                                   | ❌ won't implement                                    |

---

## Feature support

| Feature                                              | Status                              |
| ---------------------------------------------------- | ----------------------------------- |
| Position & size                                      | ✅                                  |
| Colors (background, foreground, border, on/off/line) | ✅                                  |
| Font (family, size, bold, italic)                    | ✅                                  |
| Text alignment (horizontal & vertical)               | ✅                                  |
| Visibility                                           | ✅                                  |
| Tooltip                                              | ✅                                  |
| Transparent background                               | ✅                                  |
| Display macros                                       | ✅                                  |
| Grid settings (color, visibility, step)              | ✅                                  |
| Embedded display path (`.bob` → `.opi.json`)         | ✅                                  |
| Multi-state LED states (value, color, label)         | ✅                                  |
| Actions                                              | ✅ (write PV and open display only) |
| Rules                                                | 🔶 not implemented                  |
| Plot PV names & line colors                          | 🔶 not implemented                  |
| Tab pane content                                     | 🔶 not implemented                  |
| Points (polyline / line drawing)                     | 🔶 not implemented                  |
| Scripts                                              | ❌ won't implement                  |
| Points (polygon geometry)                            | ❌ won't implement                  |

---

## Adding a widget

1. Add the Phoebus type to `PhoebusWidgetType` in `constants.ts` if missing.
2. Add a `WidgetMapEntry` to `WIDGET_MAP` in `mapping.ts`.
3. Set `hasFont: true` when font settings are present.
4. Add default Phoebus values in `PHOEBUS_WIDGET_DEFAULTS` in `defaults.ts`.
