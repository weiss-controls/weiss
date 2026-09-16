import * as echarts from "echarts/core";
import {
  LineChart,
  type LineSeriesOption,
  BarChart,
  type BarSeriesOption,
  HeatmapChart,
  type HeatmapSeriesOption,
} from "echarts/charts";
import {
  GridComponent,
  type GridComponentOption,
  TooltipComponent,
  type TooltipComponentOption,
  TitleComponent,
  type TitleComponentOption,
  LegendComponent,
  type LegendComponentOption,
  DataZoomComponent,
  type DataZoomComponentOption,
  ToolboxComponent,
  type ToolboxComponentOption,
  VisualMapComponent,
  type VisualMapComponentOption,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

// Register everything
echarts.use([
  // Charts
  LineChart,
  BarChart,
  HeatmapChart,
  // Components
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  VisualMapComponent,
  // Renderer
  CanvasRenderer,
]);

export type ECOption = echarts.ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | HeatmapSeriesOption
  | TitleComponentOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | DataZoomComponentOption
  | ToolboxComponentOption
  | VisualMapComponentOption
>;

export { echarts };
