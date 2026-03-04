// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useCallback, useMemo, useState } from "react";
import type {
  WidgetProperties,
  PropertyKey,
  PropertyValue,
  WidgetProperty,
  MultiWidgetPropertyUpdates,
} from "@src/types/widgets";
import { CATEGORY_DISPLAY_ORDER } from "@src/types/widgetProperties";
import PropertyGroups from "./PropertyGroups";
import { useWidgetContext } from "@src/context/useWidgetContext";

const getGroupedProperties = (properties: WidgetProperties) => {
  const groups: Record<string, Record<string, WidgetProperty>> = {};
  if (!properties) return groups;

  const presentCategories = new Set(Object.values(properties).map((p) => p.category));

  CATEGORY_DISPLAY_ORDER.filter((c) => presentCategories.has(c)).forEach((c) => (groups[c] = {}));

  Array.from(presentCategories)
    .filter((c) => !CATEGORY_DISPLAY_ORDER.includes(c))
    .forEach((c) => (groups[c] = {}));

  for (const [name, prop] of Object.entries(properties)) {
    const category = prop.category ?? "Other";
    groups[category][name] = prop;
  }

  for (const category of Object.keys(groups)) {
    const entries = Object.entries(groups[category]);

    const sorted = [
      ...entries.filter(
        ([, p]) =>
          p.selType !== "boolean" && p.selType !== "colorSel" && p.selType !== "colorSelList",
      ),
      ...entries.filter(([, p]) => p.selType === "colorSelList"),
      ...entries.filter(([, p]) => p.selType === "colorSel"),
      ...entries.filter(([, p]) => p.selType === "boolean"),
    ];

    groups[category] = Object.fromEntries(sorted);
  }

  return groups;
};

const PropertiesTab: React.FC = () => {
  const { editingWidgets, batchWidgetUpdate } = useWidgetContext();

  const singleWidget = editingWidgets.length === 1;

  const properties: WidgetProperties = useMemo(() => {
    if (editingWidgets.length === 0) return {};
    if (singleWidget) return editingWidgets[0].editableProperties;

    const common: WidgetProperties = {
      ...editingWidgets[0].editableProperties,
    };

    for (let i = 1; i < editingWidgets.length; i++) {
      const current = editingWidgets[i].editableProperties;
      for (const key of Object.keys(common)) {
        if (!(current[key as PropertyKey] as WidgetProperty)) {
          delete common[key as PropertyKey];
        }
      }
    }

    return common;
  }, [editingWidgets, singleWidget]);

  const groupedProperties = useMemo(() => getGroupedProperties(properties), [properties]);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = useCallback((category: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [category]: !(prev[category] ?? true),
    }));
  }, []);

  const handlePropChange = (propName: PropertyKey, newValue: PropertyValue) => {
    const updates: MultiWidgetPropertyUpdates = {};
    editingWidgets.forEach((w) => {
      updates[w.id] = { [propName]: newValue };
    });
    batchWidgetUpdate(updates);
  };

  return (
    <PropertyGroups
      groupedProperties={groupedProperties}
      collapsedGroups={collapsedGroups}
      onToggleGroup={toggleGroup}
      onChange={handlePropChange}
    />
  );
};

export default PropertiesTab;
