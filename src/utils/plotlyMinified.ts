// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

// Minimal Plotly bundle — only the trace types WEISS widgets actually use
// (scatter for GraphY/GraphXY, histogram for Histogram). Avoids pulling in
// the full plotly.js distribution, which otherwise accounts for the majority
// of the production bundle size.

import Plotly from "plotly.js/lib/core";
import scatter from "plotly.js/lib/scatter";
import histogram from "plotly.js/lib/histogram";
import createPlotlyComponent from "react-plotly.js/factory";

Plotly.register([scatter, histogram]);

export default createPlotlyComponent(Plotly);
