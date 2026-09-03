# Phoebus `.bob` -> WEISS `.opi.json` converter

Converts Phoebus Display Builder XML files (`.bob`) into WEISS widget arrays (`.opi.json`).

For the current widget and feature support tables, see
[docs/src/getting_started/importing_files.md](../../../docs/src/getting_started/importing_files.md).

---

## Adding a widget

1. Add the Phoebus type to `PhoebusWidgetType` in `constants.ts` if missing.
2. Add a `WidgetMapEntry` to `WIDGET_MAP` in `mapping.ts`.
3. Set `hasFont: true` when font settings are present.
4. Add default Phoebus values in `PHOEBUS_WIDGET_DEFAULTS` in `defaults.ts`.
