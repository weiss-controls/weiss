// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  TextField,
  Select,
  MenuItem,
  ListSubheader,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  Stack,
  Tooltip,
} from "@mui/material";
import { RichTreeView } from "@mui/x-tree-view/RichTreeView";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import type {
  Rule,
  RuleCondition,
  RuleOperator,
  PropertyKey,
  PropertyValue,
  RuleSet,
  WidgetProperties,
} from "@src/types/widgets";
import { PROPERTY_SCHEMAS, CATEGORY_DISPLAY_ORDER } from "@src/types/widgetProperties";
import { COLORS } from "@src/constants/constants";
import {
  OPERATORS,
  ACTIONABLE_SEL_TYPES,
  makeEmptyCondition,
  makeEmptyRuleset,
  makeEmptyRule,
  derivePVNames,
} from "./ruleDialogUtils";
import ActionValueInput from "./ActionValueInput";

interface RulesDialogProps {
  open: boolean;
  widgetId: string;
  widgetProperties: WidgetProperties;
  initialRules: Rule[];
  onSave: (rules: Rule[]) => void;
  onClose: () => void;
  /** Current GridZone macro key -> value map, used as base keys for globalMacros actions. */
  globalMacros?: Record<string, string>;
}

const RulesDialog: React.FC<RulesDialogProps> = ({
  open,
  widgetProperties,
  initialRules,
  onSave,
  onClose,
  globalMacros,
}) => {
  const [rules, setRules] = useState<Rule[]>(() => initialRules);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  // Actionable properties that can be targeted by rules, sorted by schema order.
  const schemaKeyOrder = Object.keys(PROPERTY_SCHEMAS) as PropertyKey[];
  const actionableKeys: PropertyKey[] = [
    ...schemaKeyOrder.filter((key) => {
      const prop = widgetProperties[key];
      return prop && ACTIONABLE_SEL_TYPES.has(prop.selType) && key !== "rules";
    }),
    // globalMacros is always available on every widget as a rule target
    ...(!widgetProperties.globalMacros ? (["globalMacros"] as PropertyKey[]) : []),
  ];

  // Group actionable keys by category for the target-property selector.
  const groupedActionableKeys = (() => {
    const groups: Record<string, PropertyKey[]> = {};
    for (const key of actionableKeys) {
      const cat = PROPERTY_SCHEMAS[key]?.category ?? "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(key);
    }
    return [...CATEGORY_DISPLAY_ORDER, "Other"]
      .filter((cat) => groups[cat]?.length > 0)
      .map((cat) => ({ category: cat, keys: groups[cat] }));
  })();

  // Sync from props whenever the target widget changes
  // Do this only while the dialog is closed (avoids resetting mid-edit)
  useEffect(() => {
    if (!open) {
      setRules(initialRules);
      setSelectedIdx(0);
    }
  }, [initialRules, open]);

  const selected = rules[selectedIdx] ?? null;
  const selectedRuleId = selected?.id ?? null;

  const ruleTreeItems = rules.map((rule, idx) => ({
    id: rule.id,
    label: rule.name || `Rule ${idx + 1}`,
  }));

  const updateSelected = useCallback(
    (patch: Partial<Rule>) => {
      if (selected === null) return;
      setRules((prev) => prev.map((r, i) => (i === selectedIdx ? { ...r, ...patch } : r)));
    },
    [selected, selectedIdx],
  );

  const updateSelectedRulesets = useCallback(
    (mutator: (rulesets: RuleSet[]) => RuleSet[]) => {
      if (!selected) return;
      updateSelected({ rulesets: mutator(selected.rulesets) });
    },
    [selected, updateSelected],
  );

  // Rule list mutations
  const addRule = () => {
    if (actionableKeys.length === 0) return;
    const next = [...rules, makeEmptyRule(actionableKeys[0])];
    setRules(next);
    setSelectedIdx(next.length - 1);
  };

  const deleteRule = (idx: number) => {
    const next = rules.filter((_, i) => i !== idx);
    setRules(next);
    setSelectedIdx(Math.min(selectedIdx, next.length - 1));
  };

  const moveRule = (idx: number, dir: -1 | 1) => {
    const next = [...rules];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setRules(next);
    setSelectedIdx(target);
  };

  const updateRuleName = (idx: number, name: string) => {
    setRules((prev) => prev.map((rule, i) => (i === idx ? { ...rule, name } : rule)));
  };

  const selectRuleById = (itemId: string | null) => {
    if (!itemId) return;
    const idx = rules.findIndex((rule) => rule.id === itemId);
    if (idx >= 0) setSelectedIdx(idx);
  };

  const changeRuleTargetProperty = (newKey: PropertyKey) => {
    if (!selected || selected.targetProperty === newKey) return;
    updateSelected({
      targetProperty: newKey,
      rulesets: selected.rulesets.map((ruleset) => ({
        ...ruleset,
        value: PROPERTY_SCHEMAS[newKey]?.value ?? "",
      })),
    });
  };

  // Ruleset-level mutations
  const addRuleset = () => {
    if (!selected) return;
    updateSelectedRulesets((prev) => [...prev, makeEmptyRuleset(selected.targetProperty)]);
  };

  const removeRuleset = (rulesetIdx: number) => {
    updateSelectedRulesets((prev) => prev.filter((_, idx) => idx !== rulesetIdx));
  };

  const updateRuleset = (rulesetIdx: number, patch: Partial<RuleSet>) => {
    updateSelectedRulesets((prev) =>
      prev.map((ruleset, idx) => (idx === rulesetIdx ? { ...ruleset, ...patch } : ruleset)),
    );
  };

  // Condition mutations (within a specific ruleset)
  const addCondition = (rulesetIdx: number) => {
    if (!selected) return;
    const ruleset = selected.rulesets[rulesetIdx];
    if (!ruleset) return;
    const conditions = [...ruleset.conditions, makeEmptyCondition()];
    updateRuleset(rulesetIdx, { conditions, pvNames: derivePVNames(conditions) });
  };

  const removeCondition = (rulesetIdx: number, conditionIdx: number) => {
    if (!selected) return;
    const ruleset = selected.rulesets[rulesetIdx];
    if (!ruleset) return;
    const conditions = ruleset.conditions.filter((_, idx) => idx !== conditionIdx);
    updateRuleset(rulesetIdx, { conditions, pvNames: derivePVNames(conditions) });
  };

  const updateCondition = (
    rulesetIdx: number,
    conditionIdx: number,
    patch: Partial<RuleCondition>,
  ) => {
    if (!selected) return;
    const ruleset = selected.rulesets[rulesetIdx];
    if (!ruleset) return;
    const conditions = ruleset.conditions.map((condition, idx) =>
      idx === conditionIdx ? { ...condition, ...patch } : condition,
    );
    updateRuleset(rulesetIdx, { conditions, pvNames: derivePVNames(conditions) });
  };

  const changeRulesetValue = (rulesetIdx: number, value: PropertyValue) => {
    updateRuleset(rulesetIdx, { value });
  };

  const handleSave = () => {
    onSave(rules);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>Widget Rules</DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <Box sx={{ display: "flex", height: 560 }}>
          {/* Left panel: rule list */}
          <Box
            sx={{
              width: 200,
              borderRight: "1px solid",
              borderColor: "divider",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: 1,
                py: 0.5,
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Rules
              </Typography>
              <Box sx={{ display: "flex" }}>
                <Tooltip title="Move up">
                  <span>
                    <IconButton
                      size="small"
                      disabled={selectedIdx <= 0 || rules.length <= 1}
                      onClick={() => moveRule(selectedIdx, -1)}
                    >
                      <ArrowUpwardIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Move down">
                  <span>
                    <IconButton
                      size="small"
                      disabled={selectedIdx < 0 || selectedIdx >= rules.length - 1}
                      onClick={() => moveRule(selectedIdx, 1)}
                    >
                      <ArrowDownwardIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Delete rule">
                  <span>
                    <IconButton
                      size="small"
                      disabled={selectedIdx < 0 || rules.length === 0}
                      onClick={() => deleteRule(selectedIdx)}
                    >
                      <DeleteIcon sx={{ fontSize: 14 }} color="error" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Add rule">
                  <IconButton size="small" onClick={addRule} disabled={actionableKeys.length === 0}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            <Box sx={{ flex: 1, overflowY: "auto", px: 0.5, py: 0.5 }}>
              {rules.length > 0 ? (
                <RichTreeView
                  items={ruleTreeItems}
                  selectedItems={selectedRuleId}
                  onSelectedItemsChange={(_e, itemId) => selectRuleById(itemId)}
                  isItemEditable
                  onItemLabelChange={(itemId, newLabel) => {
                    const idx = rules.findIndex((rule) => rule.id === itemId);
                    if (idx >= 0) updateRuleName(idx, newLabel);
                  }}
                />
              ) : (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ px: 1.5, py: 1, display: "block" }}
                >
                  No rules. Click + to add one.
                </Typography>
              )}
            </Box>
          </Box>

          {/* Right panel: rule editor */}
          <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
            {selected === null ? (
              <Typography variant="body2" color="text.secondary">
                Select or create a rule.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {/* Target property */}
                Affected property:
                <Select<PropertyKey>
                  size="small"
                  value={selected.targetProperty}
                  onChange={(e) => changeRuleTargetProperty(e.target.value)}
                  displayEmpty
                  fullWidth
                >
                  {groupedActionableKeys.map(({ category, keys: catKeys }) => [
                    <ListSubheader
                      key={`cat-${category}`}
                      sx={{
                        lineHeight: "28px",
                        fontSize: "0.7rem",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      {category}
                    </ListSubheader>,
                    ...catKeys.map((k) => (
                      <MenuItem key={k} value={k}>
                        {PROPERTY_SCHEMAS[k]?.label ?? k}
                      </MenuItem>
                    )),
                  ])}
                </Select>
                <Divider />
                {/* Rulesets */}
                <Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      mb: 1,
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
                      Rulesets
                    </Typography>
                    <Tooltip title="Add ruleset">
                      <IconButton size="small" onClick={addRuleset}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <Stack spacing={1}>
                    {selected.rulesets.map((ruleset, rulesetIdx) => (
                      <Box
                        key={ruleset.id}
                        sx={{
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 1,
                          p: 1.25,
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            mb: 1,
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            Ruleset {rulesetIdx + 1}
                          </Typography>
                          <Tooltip title="Remove ruleset">
                            <IconButton size="small" onClick={() => removeRuleset(rulesetIdx)}>
                              <DeleteIcon fontSize="small" color="error" />
                            </IconButton>
                          </Tooltip>
                        </Box>

                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 260px)",
                            gap: 1.5,
                            alignItems: "stretch",
                          }}
                        >
                          <Box>
                            {ruleset.conditions.length > 1 && (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                                <Typography variant="body2">Associative logic:</Typography>
                                <ToggleButtonGroup
                                  exclusive
                                  size="small"
                                  value={ruleset.conditionLogic}
                                  onChange={(_e, v: "AND" | "OR" | null) =>
                                    v && updateRuleset(rulesetIdx, { conditionLogic: v })
                                  }
                                  sx={{ height: 25 }}
                                >
                                  <ToggleButton value="AND">AND</ToggleButton>
                                  <ToggleButton value="OR">OR</ToggleButton>
                                </ToggleButtonGroup>
                              </Box>
                            )}

                            <Stack spacing={1}>
                              {ruleset.conditions.map((cond, conditionIdx) => (
                                <Box
                                  key={conditionIdx}
                                  sx={{ display: "flex", gap: 1, alignItems: "center" }}
                                >
                                  <TextField
                                    size="small"
                                    label="PV name"
                                    value={cond.pvName}
                                    onChange={(e) =>
                                      updateCondition(rulesetIdx, conditionIdx, {
                                        pvName: e.target.value,
                                      })
                                    }
                                    sx={{ flex: 1, minWidth: 140 }}
                                  />
                                  <Select
                                    size="small"
                                    value={cond.operator}
                                    onChange={(e) =>
                                      updateCondition(rulesetIdx, conditionIdx, {
                                        operator: e.target.value as RuleOperator,
                                      })
                                    }
                                    sx={{ width: 72 }}
                                  >
                                    {OPERATORS.map((op) => (
                                      <MenuItem key={op} value={op}>
                                        {op}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                  <TextField
                                    size="small"
                                    label="Value"
                                    value={cond.value}
                                    onChange={(e) =>
                                      updateCondition(rulesetIdx, conditionIdx, {
                                        value: e.target.value,
                                      })
                                    }
                                    sx={{ width: 130 }}
                                  />
                                  <Tooltip title="Remove condition">
                                    <IconButton
                                      size="small"
                                      onClick={() => removeCondition(rulesetIdx, conditionIdx)}
                                    >
                                      <DeleteIcon fontSize="small" color="error" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              ))}

                              <Box>
                                <Button size="small" onClick={() => addCondition(rulesetIdx)}>
                                  Add condition
                                </Button>
                              </Box>
                            </Stack>
                          </Box>

                          <Box
                            sx={{
                              borderLeft: "1px solid",
                              borderColor: "divider",
                              pl: 1.5,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Stack
                              spacing={1}
                              sx={{
                                width: "100%",
                                maxWidth: 230,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Typography variant="body2" sx={{ textAlign: "center" }}>
                                Resulting value
                              </Typography>
                              <Box
                                sx={{
                                  width: "100%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <ActionValueInput
                                  propKey={selected.targetProperty}
                                  value={ruleset.value}
                                  baseValue={
                                    selected.targetProperty === "globalMacros"
                                      ? (globalMacros ?? {})
                                      : selected.targetProperty === "macros"
                                        ? (widgetProperties.macros?.value ?? {})
                                        : undefined
                                  }
                                  onChange={(v) => changeRulesetValue(rulesetIdx, v)}
                                />
                              </Box>
                            </Stack>
                          </Box>
                        </Box>
                      </Box>
                    ))}

                    {selected.rulesets.length === 0 && (
                      <Typography variant="caption" color="text.secondary">
                        No rulesets — rule will never apply.
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Stack>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} sx={{ "&:not(.Mui-disabled)": { color: COLORS.midDarkBlue } }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          sx={{ "&:not(.Mui-disabled)": { backgroundColor: COLORS.midDarkBlue } }}
          onClick={handleSave}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RulesDialog;
