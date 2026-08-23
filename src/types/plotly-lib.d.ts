// plotly.js does not ship type declarations for its individual lib/* entrypoints.
declare module "plotly.js/lib/core" {
  interface PlotlyCore extends Omit<typeof import("plotly.js"), "register"> {
    register(modules: unknown[]): void;
  }
  const Plotly: PlotlyCore;
  export default Plotly;
}

declare module "plotly.js/lib/scatter" {
  const scatterModule: unknown;
  export default scatterModule;
}

declare module "plotly.js/lib/histogram" {
  const histogramModule: unknown;
  export default histogramModule;
}
