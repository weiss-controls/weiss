// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import * as React from "react";
import type { GridPosition } from "@src/types/widgets";
import type { PVData } from "@src/types/epicsWS";
import { useUIContext } from "@src/context/useUIContext";
import EditContextMenu from "./EditContextMenu";
import RuntimeContextMenu from "./RuntimeContextMenu";

export interface ContextMenuProps {
  pos: GridPosition;
  mousePos: GridPosition;
  visible: boolean;
  onClose: () => void;
  pvName?: string | null;
  pvData?: PVData | null;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  pos,
  mousePos,
  visible,
  onClose,
  pvName = null,
  pvData = null,
}) => {
  const { inEditMode } = useUIContext();

  if (inEditMode) {
    return <EditContextMenu pos={pos} mousePos={mousePos} visible={visible} onClose={onClose} />;
  }

  return (
    <RuntimeContextMenu
      pos={pos}
      visible={visible}
      onClose={onClose}
      pvName={pvName}
      pvData={pvData}
    />
  );
};

export default ContextMenu;
