# WEISS

Web-based EPICS OPI designer and runtime viewer. Developers design display panels in the browser,
store them in Git repositories, and operators view them with live PV data over WebSocket.

| Service                    | Path               | Stack                                                       |
| -------------------------- | ------------------ | ----------------------------------------------------------- |
| Frontend SPA (Vite, NGINX) | `src/`             | React 19, TypeScript, MUI, Zustand, react-rnd, ECharts      |
| `weiss-api` (:8000)        | `backend/api/`     | FastAPI, Pydantic v2, Authlib; Git via `subprocess`         |
| `weiss-epicsws` (:8080)    | `backend/epicsWS/` | `websockets`, `p4p` (PVA), PyEpics (CA), `uvloop`, `orjson` |

Docs (read the relevant one before working in an area):

- `docs/src/developer/architecture.md`: contexts and stores, rendering, services, API route groups,
  epicsWS wire format (binary array frames).
- `docs/src/developer/creating_widget.md`: adding a widget, property groups, reading PV data.
- `docs/src/developer/contributing.md`: PR and API guidelines.
- `docs/src/production/`: env variables, roles, OAuth providers, Git interaction.
- `src/components/Widgets/AreaDetector/README.md`: image widget data flow and conventions.

## Commands

```bash
pnpm dev                                   # frontend only, :5173
docker compose -f docker-compose-dev.yml up --build   # full stack (needs roles.toml from backend/api/roles.example.toml)
pnpm lint && pnpm format-check             # oxlint (type-aware) + prettier
pnpm typecheck                             # tsc -b
ruff check backend/api backend/epicsWS && ruff format --check backend/api backend/epicsWS
pnpm exec openapi-ts                       # regenerate src/services/APIClient (API running on :8000)
```

There are no automated tests. Run the checks above after changes; CI runs the same ones.

## Frontend

- Aliases: `@src` → `src/`, `@components` → `src/components/`.
- Live PV data lives in Zustand (`src/services/pvStore.ts`), never in React context. Components read
  it with a PV-specific selector. Image frames go to `src/services/imageStore.ts` instead and never
  reach props, rules or macros.
- UI-only state (mode, panning, sidebar, widget picker) is in `src/stores/uiStore.ts`. Read the mode
  with `useUIStore((s) => s.inEditMode)`, not from a context. Switch mode with `updateMode`
  (`src/stores/actions.ts`, where actions spanning several stores live), which also starts/stops the
  WS session and the rule-macro sync. Store conventions: `src/stores/README.md`.
- The PV WebSocket session is a module (`src/services/WSClient/session.ts`): import `writePVValue`,
  `takeSnapshot`, etc. directly. Its connection state is in `src/stores/wsStore.ts`.
- PV array values are `NumericArray` typed-array views: use `isNumericArray()`
  (`src/utils/numericArray.ts`), not `Array.isArray()`, and avoid copying them.
- `editorStore` (`src/stores/editorStore.ts`): `editorWidgets` is a flat list with the grid at index
  0 (`GRID_ID`). Every change of the list or of the macro overrides goes through `commit()`, which
  stamps runtime PV names and recomputes the derived fields (`widgetIdMap`, selection, macros,
  `resolvedPVList`); widget edits use `updateEditorWidgetList` (or its wrappers
  `updateWidgetProperties` / `batchWidgetUpdate`), which also records undo history. Selection
  changes go through `setSelectedWidgetIDs`.
- All widget properties are defined once in `PROPERTY_SCHEMAS` (`src/types/widgetProperties.ts`) and
  shared by every widget; prefix widget-specific names (e.g. `imageRotation`). `isPV: true` marks a
  property whose value is a PV name to subscribe, resolved into `Widget.runtimeAuxPVs`.
- Rules: one rule targets one property; the last matching ruleset wins, and later rules win. Legacy
  action-map rules are converted on import (`src/utils/ruleCompatibility.ts`).
- Widgets that load another `.opi.json` at render time (`EmbeddedDisplay`, `NavigationTabs`) inject
  it as `data.children`. Reuse `src/components/Widgets/shared/` for this, and special-case new ones
  wherever `EmbeddedDisplay` is: `WidgetRenderer.tsx` (`childIsEmbedded`), `editorStore.ts`
  (`ungroupSelected`, `formatWdgToExport`), `WidgetTree.tsx` (`buildLayerItems`).
- `src/services/APIClient/` is generated: never edit it by hand.
- `src/utils/bob2json/` converts Phoebus `.bob` files (see its README). Widgets and properties
  missing from `mapping.ts` are dropped on import.

## Backend API

- Routers: `auth` (`/api/v1/auth`, package `api/auth/`), `repos/staging.py`
  (`/api/v1/repos/staging`, `require_developer`), `repos/deployed.py` (`/api/v1/repos/runtime`),
  `snapshots/snapshots.py` (`/api/v1/snapshots`).
- Every endpoint needs a unique `operation_id`; it names the generated client function. Regenerate
  the client in the same commit.
- Sessions and users are in-memory. Roles come from `roles.toml` (`ROLES_CONFIG_FILE`).
- Repo storage: `<repo_id>/{repo.json, bare/, worktrees/<user>/, deployments/<uuid>/, current}`.
  Files and folders prefixed `_` are hidden in runtime mode. Blank OPI template: `NEW_FILE_CONTENT`
  in `repos/common.py`.

## epicsWS

Delivery pipeline in `epicsWS.py`: EPICS callbacks are queued (`_enqueue_loop_callback`) and
dispatched in batches on the event loop; `_send_throttled` applies the per-PV rate limit
(`EPICS_MAX_UPDATE_RATE_HZ`); `send_update` serializes once and pushes to each client's
`ClientSendQueue`, drained by one `_writer` task per client. A waiting array frame is replaced by
the next frame of the same PV; scalars, first (metadata) messages and disconnects stay in order.
Keep `send_update` synchronous and use `orjson`, not `json`. The frontend and bridge are released
together, so wire format changes need both sides (`src/types/epicsWS.ts`, `src/services/WSClient/`).

## Conventions

- New source files start with the license header (`#` comments in Python):
  ```
  // SPDX-License-Identifier: GPL-3.0-or-later
  // Copyright (C) 2026 WEISS Contributors
  ```
- Keep code self-documenting. Comments and docstrings are short and only explain non-obvious logic
  or decisions; no long examples.
- Write plainly in comments, docs and messages. State what code does, not the failure it prevents:
  avoid constructions like "do X so Y never happens" or "so that X is always Y".
- When a change makes this file or the docs above outdated, update them in the same change.
