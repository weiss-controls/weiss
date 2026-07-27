// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

/**
 * Dry-run script for the Phoebus → WEISS converter pipeline.
 *
 * Run with:
 *   npx ts-node src/utils/phoebusConverter/dryRun.ts
 * or:
 *   npx tsx src/utils/phoebusConverter/dryRun.ts
 */

import { DOMParser } from "@xmldom/xmldom";
(globalThis as unknown as Record<string, unknown>).DOMParser = DOMParser;

import { parsePhoebus } from "./parser";
import { convertDisplay } from "./converter";
/* -------------------------------------------------------------------------- */
/* Sample Phoebus XML                                                          */
/* -------------------------------------------------------------------------- */

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<display version="2.0.0">
  <name>Dry Run Display</name>
  <width>1280</width>
  <height>720</height>
  <background_color>
    <color name="Write Background" red="220" green="225" blue="221" />
  </background_color>

  <!-- 1. Label — static text, no PV -->
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

  <!-- 2. TextUpdate — reads and displays a PV value -->
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

  <!-- 3. TextEntry — operator writes a setpoint to a PV -->
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

  <!-- 4. LED — boolean indicator driven by a PV -->
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

  <!-- 5. ActionButton — writes a value to a PV on click -->
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

/* -------------------------------------------------------------------------- */
/* Pipeline                                                                    */
/* -------------------------------------------------------------------------- */

function main(): void {
  console.log("=== Phoebus → WEISS dry run ===\n");

  // Stage 1: XML → PhoebusDisplay
  console.log("Stage 1: parsing XML...");
  const display = parsePhoebus(SAMPLE_XML);
  console.log(`  version : ${display.version}`);
  console.log(`  size    : ${display.width} × ${display.height}`);
  console.log(`  widgets : ${display.widgets.length}`);
  display.widgets.forEach((w) => console.log(`    • [${w.type}] ${w.name ?? "unnamed"}`));

  // Stage 2: PhoebusDisplay → ExportedWidget[]
  console.log("\nStage 2: converting to WEISS format...");
  const { widgets, warnings } = convertDisplay(display);

  if (warnings.length > 0) {
    console.warn("\n  ⚠ Warnings:");
    warnings.forEach((w) => console.warn(`    ${w}`));
  } else {
    console.log("  No warnings.");
  }

  // Stage 3: serialise to .opi.json
  console.log("\nStage 3: serialising...");
  const opiJson = JSON.stringify(widgets, null, 2);

  console.log("\n=== Output (.opi.json) ===\n");
  console.log(opiJson);
}

main();
