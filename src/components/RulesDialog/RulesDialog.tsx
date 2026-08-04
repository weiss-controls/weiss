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
  List,
  ListItemButton,
  ListItemText,
} from "@mui/material";
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
  RuleOutcome,
  WidgetProperties,
} from "@src/types/widgets";
import { PROPERTY_SCHEMAS, CATEGORY_DISPLAY_ORDER } from "@src/types/widgetProperties";
import { COLORS } from "@src/constants/constants";
import {
  OPERATORS,
  ACTIONABLE_SEL_TYPES,
  makeEmptyCondition,
  makeEmptyOutcome,
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

  const updateSelected = useCallback(
    (patch: Partial<Rule>) => {
      if (selected === null) return;
      setRules((prev) => prev.map((r, i) => (i === selectedIdx ? { ...r, ...patch } : r)));
    },
    [selected, selectedIdx],
  );

  const updateSelectedOutcomes = useCallback(
    (mutator: (outcomes: RuleOutcome[]) => RuleOutcome[]) => {
      if (!selected) return;
      updateSelected({ outcomes: mutator(selected.outcomes) });
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

  const changeRuleTargetProperty = (newKey: PropertyKey) => {
    if (!selected || selected.targetProperty === newKey) return;
    updateSelected({
      targetProperty: newKey,
      outcomes: selected.outcomes.map((outcome) => ({
        ...outcome,
        value: PROPERTY_SCHEMAS[newKey]?.value ?? "",
      })),
    });
  };

  // Outcome-level mutations
  const addOutcome = () => {
    if (!selected) return;
    updateSelectedOutcomes((prev) => [...prev, makeEmptyOutcome(selected.targetProperty)]);
  };

  const removeOutcome = (outcomeIdx: number) => {
    updateSelectedOutcomes((prev) => prev.filter((_, idx) => idx !== outcomeIdx));
  };

  const updateOutcome = (outcomeIdx: number, patch: Partial<RuleOutcome>) => {
    updateSelectedOutcomes((prev) =>
      prev.map((outcome, idx) => (idx === outcomeIdx ? { ...outcome, ...patch } : outcome)),
    );
  };

  // Condition mutations (within a specific outcome)
  const addCondition = (outcomeIdx: number) => {
    if (!selected) return;
    const outcome = selected.outcomes[outcomeIdx];
    if (!outcome) return;
    const conditions = [...outcome.conditions, makeEmptyCondition()];
    updateOutcome(outcomeIdx, { conditions, pvNames: derivePVNames(conditions) });
  };

  const removeCondition = (outcomeIdx: number, conditionIdx: number) => {
    if (!selected) return;
    const outcome = selected.outcomes[outcomeIdx];
    if (!outcome) return;
    const conditions = outcome.conditions.filter((_, idx) => idx !== conditionIdx);
    updateOutcome(outcomeIdx, { conditions, pvNames: derivePVNames(conditions) });
  };

  const updateCondition = (
    outcomeIdx: number,
    conditionIdx: number,
    patch: Partial<RuleCondition>,
  ) => {
    if (!selected) return;
    const outcome = selected.outcomes[outcomeIdx];
    if (!outcome) return;
    const conditions = outcome.conditions.map((condition, idx) =>
      idx === conditionIdx ? { ...condition, ...patch } : condition,
    );
    updateOutcome(outcomeIdx, { conditions, pvNames: derivePVNames(conditions) });
  };

  const changeOutcomeValue = (outcomeIdx: number, value: PropertyValue) => {
    updateOutcome(outcomeIdx, { value });
  };

  const handleSave = () => {
    onSave(rules);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Widget Rules</DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <Box sx={{ display: "flex", height: 480 }}>
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
              <Tooltip title="Add rule">
                <IconButton size="small" onClick={addRule} disabled={actionableKeys.length === 0}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            <List dense disablePadding sx={{ flex: 1, overflowY: "auto" }}>
              {rules.map((rule, idx) => (
                <ListItemButton
                  key={rule.id}
                  selected={idx === selectedIdx}
                  onClick={() => setSelectedIdx(idx)}
                  sx={{ pr: 0.5 }}
                >
                  <ListItemText
                    primary={rule.name || "(unnamed)"}
                    slotProps={{
                      primary: { noWrap: true, variant: "body2" },
                    }}
                  />
                  <Box sx={{ display: "flex", flexShrink: 0 }}>
                    <Tooltip title="Move up">
                      <span>
                        <IconButton
                          size="small"
                          disabled={idx === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveRule(idx, -1);
                          }}
                        >
                          <ArrowUpwardIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Move down">
                      <span>
                        <IconButton
                          size="small"
                          disabled={idx === rules.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveRule(idx, 1);
                          }}
                        >
                          <ArrowDownwardIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Delete rule">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteRule(idx);
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: 14 }} color="error" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItemButton>
              ))}
              {rules.length === 0 && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ px: 2, py: 1, display: "block" }}
                >
                  No rules. Click + to add one.
                </Typography>
              )}
            </List>
          </Box>

          {/* Right panel: rule editor */}
          <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
            {selected === null ? (
              <Typography variant="body2" color="text.secondary">
                Select or create a rule.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {/* Name */}
                <TextField
                  label="Rule name"
                  size="small"
                  value={selected.name}
                  onChange={(e) => updateSelected({ name: e.target.value })}
                  fullWidth
                />

                {/* Target property */}
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

                {/* Outcomes */}
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
                      Outcomes
                    </Typography>
                    <Tooltip title="Add outcome">
                      <IconButton size="small" onClick={addOutcome}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <Stack spacing={1}>
                    {selected.outcomes.map((outcome, outcomeIdx) => (
                      <Box
                        key={outcome.id}
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
                            Outcome {outcomeIdx + 1}
                          </Typography>
                          <Tooltip title="Remove outcome">
                            <IconButton size="small" onClick={() => removeOutcome(outcomeIdx)}>
                              <DeleteIcon fontSize="small" color="error" />
                            </IconButton>
                          </Tooltip>
                        </Box>

                        {outcome.conditions.length > 1 && (
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                            <Typography variant="body2">Associative logic:</Typography>
                            <ToggleButtonGroup
                              exclusive
                              size="small"
                              value={outcome.conditionLogic}
                              onChange={(_e, v: "AND" | "OR" | null) =>
                                v && updateOutcome(outcomeIdx, { conditionLogic: v })
                              }
                              sx={{ height: 25 }}
                            >
                              <ToggleButton value="AND">AND</ToggleButton>
                              <ToggleButton value="OR">OR</ToggleButton>
                            </ToggleButtonGroup>
                          </Box>
                        )}

                        <Stack spacing={1}>
                          {outcome.conditions.map((cond, conditionIdx) => (
                            <Box
                              key={conditionIdx}
                              sx={{ display: "flex", gap: 1, alignItems: "center" }}
                            >
                              <TextField
                                size="small"
                                label="PV name"
                                value={cond.pvName}
                                onChange={(e) =>
                                  updateCondition(outcomeIdx, conditionIdx, {
                                    pvName: e.target.value,
                                  })
                                }
                                sx={{ flex: 1 }}
                              />
                              <Select
                                size="small"
                                value={cond.operator}
                                onChange={(e) =>
                                  updateCondition(outcomeIdx, conditionIdx, {
                                    operator: e.target.value as RuleOperator,
                                  })
                                }
                                sx={{ width: 80 }}
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
                                  updateCondition(outcomeIdx, conditionIdx, {
                                    value: e.target.value,
                                  })
                                }
                                sx={{ flex: 1 }}
                              />
                              <Tooltip title="Remove condition">
                                <IconButton
                                  size="small"
                                  onClick={() => removeCondition(outcomeIdx, conditionIdx)}
                                >
                                  <DeleteIcon fontSize="small" color="error" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          ))}

                          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                            <Button size="small" onClick={() => addCondition(outcomeIdx)}>
                              Add condition
                            </Button>

                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
                              <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                                Set to
                              </Typography>
                              <ActionValueInput
                                propKey={selected.targetProperty}
                                value={outcome.value}
                                baseValue={
                                  selected.targetProperty === "globalMacros"
                                    ? (globalMacros ?? {})
                                    : selected.targetProperty === "macros"
                                      ? (widgetProperties.macros?.value ?? {})
                                      : undefined
                                }
                                onChange={(v) => changeOutcomeValue(outcomeIdx, v)}
                              />
                            </Box>
                          </Box>
                        </Stack>
                      </Box>
                    ))}

                    {selected.outcomes.length === 0 && (
                      <Typography variant="caption" color="text.secondary">
                        No outcomes — rule will never apply.
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
