import * as echarts from "echarts/core";
import { LineChart, type LineSeriesOption, BarChart, type BarSeriesOption } from "echarts/charts";
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
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

// Register everything
echarts.use([
  // Charts
  LineChart,
  BarChart,
  // Components
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  // Renderer
  CanvasRenderer,
]);

export type ECOption = echarts.ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | TitleComponentOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | DataZoomComponentOption
  | ToolboxComponentOption
>;

export { echarts };
