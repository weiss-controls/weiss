// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useCallback, useMemo, useState } from "react";
import type {
  WidgetProperties,
  PropertyKey,
  PropertyValue,
  WidgetProperty,
  MultiWidgetPropertyUpdates,
  Rule,
} from "@src/types/widgets";
import { CATEGORY_DISPLAY_ORDER } from "@src/types/widgetProperties";
import PropertyGroups from "./PropertyGroups";
import { useWidgetContext } from "@src/context/useWidgetContext";
import { Box, Button, Tooltip } from "@mui/material";
import RuleIcon from "@mui/icons-material/Rule";
import { RulesDialog } from "@components/RulesDialog";
import { COLORS } from "@src/constants/constants";

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
  const { editingWidgets, batchWidgetUpdate, updateWidgetRules } = useWidgetContext();

  const singleWidget = editingWidgets.length === 1;
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false);

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

  const handleSaveRules = (rules: Rule[]) => {
    if (!singleWidget) return;
    updateWidgetRules(editingWidgets[0].id, rules);
  };

  const widget = singleWidget ? editingWidgets[0] : null;
  const ruleCount = widget?.rules?.length ?? 0;

  return (
    <>
      <PropertyGroups
        groupedProperties={groupedProperties}
        collapsedGroups={collapsedGroups}
        onToggleGroup={toggleGroup}
        onChange={handlePropChange}
      />

      {singleWidget && widget && (
        <Box sx={{ px: 2, py: 1 }}>
          <Tooltip title="Edit widget rules">
            <Button
              size="small"
              startIcon={<RuleIcon fontSize="small" />}
              onClick={() => setRulesDialogOpen(true)}
              fullWidth
              variant="outlined"
              sx={{
                "&:not(.Mui-disabled)": {
                  color: COLORS.midDarkBlue,
                  borderColor: COLORS.midDarkBlue,
                },
              }}
            >
              Rules{ruleCount > 0 ? ` (${ruleCount})` : ""}
            </Button>
          </Tooltip>
        </Box>
      )}

      {widget && (
        <RulesDialog
          open={rulesDialogOpen}
          widgetId={widget.id}
          widgetProperties={widget.editableProperties}
          initialRules={widget.rules ?? []}
          onSave={handleSaveRules}
          onClose={() => setRulesDialogOpen(false)}
        />
      )}
    </>
  );
};

export default PropertiesTab;
