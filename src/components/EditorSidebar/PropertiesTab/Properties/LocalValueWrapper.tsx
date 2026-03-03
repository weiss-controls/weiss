// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useState, useEffect } from "react";
import type { PropertyValue } from "@src/types/widgets";

interface LocalValueWrapperProps {
  render: (val: PropertyValue, setVal: (v: PropertyValue) => void) => React.JSX.Element;
  initial: PropertyValue;
  onBlurCallback?: (localVal: PropertyValue) => void;
}
/**
 * Used to keep track of local value before actually commiting it to widget
 * */
const LocalValueWrapper: React.FC<LocalValueWrapperProps> = ({
  render,
  initial,
  onBlurCallback,
}) => {
  const [localVal, setLocalVal] = useState<PropertyValue>(initial);

  useEffect(() => {
    setLocalVal(initial);
  }, [initial]);

  return render(localVal, (newValue) => {
    setLocalVal(newValue);
    if (onBlurCallback) {
      onBlurCallback(newValue);
    }
  });
};

export default LocalValueWrapper;
