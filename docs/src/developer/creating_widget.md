# Creating widgets

Widgets are the building blocks of every OPI. Each widget type is a pair of files: a React component
that handles rendering, and a definition object that registers the widget with the editor.

---

## File layout

Create a new directory under `src/components/Widgets/` named after your widget:

```
src/components/Widgets/
└── MyWidget/
    ├── MyWidget.ts         # -> definition (registry entry)
    ├── MyWidgetComp.tsx    # -> React component
    └── index.ts            # -> Barrel file for exports (optional but recommended).
```

---

The order of the following steps is not mandatory, but it's recommended for a smoother development
experience. The editor reads the definition file to display the widget in the palette, so writing it
first allows you to test your component more easily as you build it.

## Step 1 - Write the definition file

The definition file exports a `WidgetDefinition` object. From this file, the editor is able to read
all metadata (label, icon, category, default properties) and render the appropriate editing menus.
Defining this file first allows you to test your component easier when you start writing it.

Example:

```ts
// src/components/Widgets/MyWidget/MyWidget.ts
import { MyWidgetComp } from "./MyWidgetComp";
import { COMMON_PROPS, PROPERTY_SCHEMAS, TEXT_PROPS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import MyIcon from "@mui/icons-material/Category"; // pick any MUI icon

export const MyWidget: WidgetDefinition = {
  component: MyWidgetComp,
  widgetName: "MyWidget", // unique key - used in saved .opi.json files
  widgetLabel: "My Widget", // display name in the editor palette
  widgetIcon: MyIcon,
  category: "Basic", // palette group
  defaultProperties: {
    label: { ...PROPERTY_SCHEMAS.label, value: "My Widget" },
    ...COMMON_PROPS, // x, y, width, height, tooltip, visible
    ...TEXT_PROPS, // fonts, text alignment, colors
    pvName: PROPERTY_SCHEMAS.pvName, // add only if the widget reads a PV
  },
};
```

:::{note}  
Creating a barrel file (`index.ts`) in the widget directory is optional but recommended for better
code organization and easier imports. It allows you to centralize exports and keep the main registry
file clean.  
:::

For convenience, some **property groups** are provided (see `widgetProperties.ts`):

| Export         | Properties included                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `COMMON_PROPS` | `x`, `y`, `width`, `height`, `tooltip`, `visible`, `borderColor`, `borderWidth`, `borderRadius`, `borderStyle`, `backgroundColor` |
| `TEXT_PROPS`   | `textColor`, `fontSize`, `fontFamily`, `fontBold`, `fontItalic`, `fontUnderlined`, `textHAlign`, `textVAlign`                     |
| `PLOT_PROPS`   | `pvNames`, `plotTitle`, `xAxisTitle`, `yAxisTitle`, `lineColors`, `logscaleY`                                                     |

For more details and all available properties, see `PROPERTY_SCHEMAS` definition in
`src/types/widgetProperties.ts`. Looking into the existing widgets in `src/components/Widgets` is
also recommended to get familiarized with the structure and patterns.

---

## Step 2 - Register the widget to the palette

Add a named export to the `src/components/Widgets/index.ts`, so the `WidgetRegistry` picks it up
automatically:

```ts
// src/components/Widgets/index.ts
export { MyWidget } from "./MyWidget";
// ... existing exports
```

From now on, your widget will appear in the editor palette under its `category`, can be dragged onto
the canvas, and will be serialised/deserialised using `widgetName` as the key.

## Step 3 - Writing the React component

Now it's time to actually design your widget. The component receives a single prop of type
`WidgetUpdate` (defined as `{ data: Widget }`, where `Widget` is the runtime instance of a widget).
Use `data.editableProperties` to read property values, and `data.pvData`/`data.multiPvData` for live
EPICS data (injected automatically at render time by `WidgetRenderer`). All properties defined in
your definition file will be available for usage by your component.

```tsx
// src/components/Widgets/MyWidget/MyWidgetComp.tsx
import type { WidgetUpdate } from "@src/types/widgets";

export function MyWidgetComp({ data }: WidgetUpdate) {
  const label = data.editableProperties.label?.value as string;
  const bg = data.editableProperties.backgroundColor?.value as string;
  const pv = data.pvData;

  return (
    <div style={{ width: "100%", height: "100%", background: bg }}>
      {label} {pv ? String(pv.value) : "-"}
    </div>
  );
}
```

### Enabling alarm border

If applicable, wrap your widget with `AlarmBorder` component. It can be used to wrap any widget
content and automatically display the coloured alarm indicator when `alarmBorder` is enabled and the
PV is in alarm:

```tsx
import { AlarmBorder } from "@components/AlarmBorder/AlarmBorder";

<AlarmBorder data={data}>{/* widget content */}</AlarmBorder>;
```

For proper resizing and dragging behaviour, it's recommended to wrap the content in a container with
`width` and `height` set to `100%`, and apply any background color or border styles to that
container instead of the root element of the component.

### Reading PV data in the component

In runtime mode, `WidgetRenderer` injects the latest value into `data.pvData` before each render of
widgets that have `pvName` property set. For multi-PV widgets (e.g., plots), `pvNames` and
`data.multiPvData` are used instead.

```ts
// Single PV
const pv = data.pvData; // PVData | undefined
if (pv) {
  const value = pv.value; // number | string | number[] | string[]
  const alarm = pv.alarm; // { severity, status, message } | undefined
  const units = pv.display?.units;
}

// Multiple PVs
const pvs = data.multiPvData; // Record<pvName, PVData> | undefined
```

:::{note}  
The `PVData` type is heavily based on the
[EPICS General Normative Types](https://docs.epics-controls.org/en/latest/pv-access/Normative-Types-Specification.html#general-normative-types).
For details and available fields, see `src/types/epicsWS.ts`.  
:::

### General notes

- **Layout:** It's recommended to use `width: 100%` and `height: 100%` on the root element of your
  component, so it fills the whole widget area and resizes properly when the user resizes the widget
  in the editor.
- **Use all properties:** If a property is available in your definition file, make sure to use it in
  your component (e.g., `fontSize`, `textColor`, `backgroundColor`, etc.) so the user can customize
  it from the editor. Always refer to the existing widgets for examples of how to use different
  properties.
- **Save renders**: For better performance, avoid unnecessary renders by using `React.memo` or
  similar techniques if your widget is complex or has expensive rendering logic.
- **Need extra properties?**: If you need a specific property that is not available, feel free to
  add it to `PROPERTY_SCHEMAS`. Make sure to follow the existing patterns.
- **Make it easy to try out:** If your widget requires a PV not available in the
  [demonstration IOCs](https://github.com/weiss-controls/weiss-demo-iocs/), consider submitting a PR
  to add it there, so other developers can easily test your widget without needing to set up their
  own IOCs.
