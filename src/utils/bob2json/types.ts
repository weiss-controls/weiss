import type { PhoebusProperty, PhoebusWidgetType } from "./constants";

export interface PhoebusWidget {
  id?: string;
  type: PhoebusWidgetType;
  name?: string;
  properties: Map<PhoebusProperty, unknown>;
  children: PhoebusWidget[];
}

export interface PhoebusDisplay {
  version?: string;
  width?: number;
  height?: number;
  widgets: PhoebusWidget[];
}
