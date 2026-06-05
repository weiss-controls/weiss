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
  WidgetProperties,
} from "@src/types/widgets";
import { PROPERTY_SCHEMAS, CATEGORY_DISPLAY_ORDER } from "@src/types/widgetProperties";
import { COLORS } from "@src/constants/constants";
import {
  OPERATORS,
  ACTIONABLE_SEL_TYPES,
  makeEmptyCondition,
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

  // Sync from props whenever the target widget changes
  // Do this only while the dialog is closed (avoids resetting mid-edit)
  useEffect(() => {
    if (!open) {
      setRules(initialRules);
      setSelectedIdx(0);
    }
  }, [initialRules, open]);

  const selected = rules[selectedIdx] ?? null;

  // Rule list mutations
  const addRule = () => {
    const next = [...rules, makeEmptyRule()];
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

  const updateSelected = useCallback(
    (patch: Partial<Rule>) => {
      if (selected === null) return;
      setRules((prev) => prev.map((r, i) => (i === selectedIdx ? { ...r, ...patch } : r)));
    },
    [selected, selectedIdx],
  );

  // Condition mutations
  const addCondition = () => {
    if (!selected) return;
    const conds = [...selected.conditions, makeEmptyCondition()];
    const pvNames = derivePVNames(conds);
    updateSelected({ conditions: conds, pvNames });
  };

  const removeCondition = (ci: number) => {
    if (!selected) return;
    const conds = selected.conditions.filter((_, i) => i !== ci);
    const pvNames = derivePVNames(conds);
    updateSelected({ conditions: conds, pvNames });
  };

  const updateCondition = (ci: number, patch: Partial<RuleCondition>) => {
    if (!selected) return;
    const conds = selected.conditions.map((c, i) => (i === ci ? { ...c, ...patch } : c));
    const pvNames = derivePVNames(conds);
    updateSelected({ conditions: conds, pvNames });
  };

  // Action mutations — sorted by PROPERTY_SCHEMAS definition order
  const schemaKeyOrder = Object.keys(PROPERTY_SCHEMAS) as PropertyKey[];
  const actionableKeys: PropertyKey[] = [
    ...schemaKeyOrder.filter((key) => {
      const prop = widgetProperties[key];
      return prop && ACTIONABLE_SEL_TYPES.has(prop.selType) && key !== "rules";
    }),
    // globalMacros is always available on every widget as a rule action
    ...(!widgetProperties.globalMacros ? (["globalMacros"] as PropertyKey[]) : []),
  ];

  // Group actionable keys by category for the property selector
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

  const addAction = () => {
    if (!selected || actionableKeys.length === 0) return;
    const usedKeys = new Set(Object.keys(selected.actions));
    const nextKey = actionableKeys.find((k) => !usedKeys.has(k)) ?? actionableKeys[0];
    const defaultValue = PROPERTY_SCHEMAS[nextKey]?.value ?? "";
    updateSelected({ actions: { ...selected.actions, [nextKey]: defaultValue } });
  };

  const removeAction = (key: PropertyKey) => {
    if (!selected) return;
    const actions = { ...selected.actions };
    delete actions[key];
    updateSelected({ actions });
  };

  const changeActionKey = (oldKey: PropertyKey, newKey: PropertyKey) => {
    if (!selected || oldKey === newKey) return;
    const actions: Rule["actions"] = {};
    // Preserve order while replacing the key
    for (const [k, v] of Object.entries(selected.actions)) {
      actions[k === oldKey ? newKey : (k as PropertyKey)] =
        k === oldKey ? (PROPERTY_SCHEMAS[newKey]?.value ?? "") : v;
    }
    updateSelected({ actions });
  };

  const changeActionValue = (key: PropertyKey, value: PropertyValue) => {
    if (!selected) return;
    updateSelected({ actions: { ...selected.actions, [key]: value } });
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
                <IconButton size="small" onClick={addRule}>
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
                <Divider />
                {/* Conditions */}
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
                      Conditions
                    </Typography>
                    <Tooltip title="Add condition">
                      <IconButton size="small" onClick={addCondition}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  {/* Condition logic toggle */}
                  {selected.conditions.length > 1 && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                      <Typography variant="body2">Associative logic:</Typography>
                      <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={selected.conditionLogic}
                        onChange={(_e, v: "AND" | "OR" | null) =>
                          v && updateSelected({ conditionLogic: v })
                        }
                        sx={{ height: 25 }}
                      >
                        <ToggleButton value="AND">AND</ToggleButton>
                        <ToggleButton value="OR">OR</ToggleButton>
                      </ToggleButtonGroup>
                    </Box>
                  )}
                  <Stack spacing={1}>
                    {selected.conditions.map((cond, ci) => (
                      <Box key={ci} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                        <TextField
                          size="small"
                          label="PV name"
                          value={cond.pvName}
                          onChange={(e) => updateCondition(ci, { pvName: e.target.value })}
                          sx={{ flex: 1 }}
                        />
                        <Select
                          size="small"
                          value={cond.operator}
                          onChange={(e) =>
                            updateCondition(ci, { operator: e.target.value as RuleOperator })
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
                          onChange={(e) => updateCondition(ci, { value: e.target.value })}
                          sx={{ flex: 1 }}
                        />
                        <Tooltip title="Remove condition">
                          <IconButton size="small" onClick={() => removeCondition(ci)}>
                            <DeleteIcon fontSize="small" color="error" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ))}
                    {selected.conditions.length === 0 && (
                      <Typography variant="caption" color="text.secondary">
                        No conditions — rule will never match.
                      </Typography>
                    )}
                  </Stack>
                </Box>

                <Divider />

                {/* Actions */}
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
                      Actions
                    </Typography>
                    <Tooltip title="Add action">
                      <span>
                        <IconButton
                          size="small"
                          onClick={addAction}
                          disabled={actionableKeys.length === 0}
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                  <Stack spacing={1}>
                    {Object.entries(selected.actions).map(([key, value]) => {
                      const propKey = key as PropertyKey;
                      const schema = PROPERTY_SCHEMAS[propKey];
                      return (
                        <Box key={key} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                          Set
                          <Select
                            size="small"
                            value={key}
                            onChange={(e) =>
                              changeActionKey(propKey, e.target.value as PropertyKey)
                            }
                            sx={{ width: "40%" }}
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
                          To
                          {schema ? (
                            <ActionValueInput
                              propKey={propKey}
                              value={value}
                              baseValue={
                                propKey === "globalMacros"
                                  ? (globalMacros ?? {})
                                  : propKey === "macros"
                                    ? (widgetProperties.macros?.value ?? {})
                                    : undefined
                              }
                              onChange={(v) => changeActionValue(propKey, v)}
                            />
                          ) : (
                            <Typography variant="caption" color="error">
                              Unknown property
                            </Typography>
                          )}
                          <Tooltip title="Remove action">
                            <IconButton size="small" onClick={() => removeAction(propKey)}>
                              <DeleteIcon fontSize="small" color="error" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      );
                    })}
                    {Object.keys(selected.actions).length === 0 && (
                      <Typography variant="caption" color="text.secondary">
                        No actions — rule will match but do nothing.
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
