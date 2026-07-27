// file to be removed - used for testing conversion without running the full app
// src/pages/DryRunPage.tsx
import { useEffect, useState } from "react";
import { parsePhoebus } from "@src/utils/bob2json/parser";
import { convertDisplay } from "@src/utils/bob2json/converter";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<display version="2.0.0">
  <name>Dry Run Display</name>
  <width>1280</width>
  <height>720</height>
  <background_color>
    <color name="Write Background" red="220" green="225" blue="221" />
  </background_color>

  <widget type="label" version="2.0.0">
    <name>Title</name>
    <x>20</x>
    <y>20</y>
    <width>400</width>
    <height>40</height>
    <text>Vacuum System Monitor</text>
    <font>
      <font family="Liberation Sans" size="18" style="BOLD" />
    </font>
    <foreground_color>
      <color name="Text: FG" red="30" green="30" blue="30" />
    </foreground_color>
    <horizontal_alignment>LEFT</horizontal_alignment>
    <vertical_alignment>MIDDLE</vertical_alignment>
    <transparent>true</transparent>
  </widget>

  <widget type="textupdate" version="2.0.0">
    <name>Pressure Readback</name>
    <x>20</x>
    <y>80</y>
    <width>200</width>
    <height>35</height>
    <pv_name>VAC:SECT1:PRESSURE</pv_name>
    <font>
      <font family="Liberation Sans" size="14" style="REGULAR" />
    </font>
    <foreground_color>
      <color name="OK" red="0" green="180" blue="0" />
    </foreground_color>
    <background_color>
      <color name="Read Background" red="240" green="240" blue="240" />
    </background_color>
    <horizontal_alignment>CENTER</horizontal_alignment>
    <border_width>1</border_width>
    <border_color>
      <color name="Border" red="100" green="100" blue="100" />
    </border_color>
  </widget>

  <widget type="textentry" version="3.0.0">
    <name>Pressure Setpoint</name>
    <x>240</x>
    <y>80</y>
    <width>200</width>
    <height>35</height>
    <pv_name>VAC:SECT1:SETPOINT</pv_name>
    <enabled>true</enabled>
    <font>
      <font family="Liberation Sans" size="14" style="REGULAR" />
    </font>
    <foreground_color>
      <color name="Text: FG" red="30" green="30" blue="30" />
    </foreground_color>
    <background_color>
      <color name="Write Background" red="255" green="255" blue="200" />
    </background_color>
    <border_width>1</border_width>
    <border_color>
      <color name="Border" red="100" green="100" blue="100" />
    </border_color>
  </widget>

  <widget type="led" version="2.0.0">
    <name>Valve Status</name>
    <x>20</x>
    <y>140</y>
    <width>30</width>
    <height>30</height>
    <pv_name>VAC:SECT1:VALVE:STATUS</pv_name>
    <tooltip>$(pv_name)
$(pv_value)</tooltip>
  </widget>

  <widget type="action_button" version="3.0.0">
    <name>Open Valve</name>
    <x>70</x>
    <y>140</y>
    <width>120</width>
    <height>30</height>
    <text>Open Valve</text>
    <enabled>true</enabled>
    <font>
      <font family="Liberation Sans" size="12" style="REGULAR" />
    </font>
    <foreground_color>
      <color name="Button FG" red="255" green="255" blue="255" />
    </foreground_color>
    <background_color>
      <color name="Button BG" red="0" green="100" blue="200" />
    </background_color>
    <tooltip>Click to open VAC:SECT1:VALVE</tooltip>
  </widget>
</display>`;

export default function DryRunPage() {
  const [output, setOutput] = useState<string>("");

  useEffect(() => {
    try {
      const display = parsePhoebus(SAMPLE_XML);
      const { widgets, warnings } = convertDisplay(display);
      const lines = [
        `version : ${display.version}`,
        `size    : ${display.width} × ${display.height}`,
        `widgets : ${display.widgets.length}`,
        ...display.widgets.map((w) => `  • [${w.type}] "${w.name ?? "(unnamed)"}"`),
        warnings.length > 0 ? `\nWarnings:\n${warnings.join("\n")}` : "\nNo warnings.",
        "\n=== Output (.opi.json) ===\n",
        JSON.stringify(widgets, null, 2),
      ];
      setOutput(lines.join("\n"));
    } catch (err) {
      setOutput(String(err));
    }
  }, []);

  return <pre style={{ padding: 24, fontSize: 13, whiteSpace: "pre-wrap" }}>{output}</pre>;
}
