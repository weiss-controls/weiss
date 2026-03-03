// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useMemo } from "react";
import "./App.css";
import { GridZone } from "./components/GridZone";
import WidgetPicker from "./components/WidgetPicker/WidgetPicker";
import EditorSidebar from "./components/EditorSidebar/EditorSidebar";
import NavBar from "./components/NavBar/NavBar";
import { GRID_ID } from "./constants/constants";
import { ScreenGuard } from "./components/ScreenGuard/ScreenGuard";
import { useWidgetContext } from "./context/useWidgetContext";

const App: React.FC = () => {
  const { editorWidgets } = useWidgetContext();
  const gridProperties = useMemo(
    () => editorWidgets.find((w) => w.id === GRID_ID),
    [editorWidgets],
  );
  return (
    <div className="app">
      <ScreenGuard />
      <div className="appBar">
        <NavBar />
      </div>
      <div className="designerArea">
        <div className="widgetPicker">
          <WidgetPicker />
        </div>
        <div id="gridContainer">
          <GridZone.component data={gridProperties!} />
        </div>
        <div className="propertyPanel">
          <EditorSidebar />
        </div>
      </div>
    </div>
  );
};

export default App;
