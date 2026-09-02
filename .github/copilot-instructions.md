<!---
Conventions, patterns, and codebase context for AI-assisted development.
For architecture, configuration, and deployment details, see docs/src/.
-->

# WEISS — AI Development Context

WEISS is a web-based EPICS OPI designer and runtime viewer: engineers design display panels in a
browser, store them in Git repositories, and serve them with real-time EPICS PV data via WebSocket.

**License header** — required on every new source file:

```
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 <Author(s) name(s)>
```

---

## High-Level Architecture

```
Browser (React + Vite)
  └─ REST  ──► FastAPI (weiss-api)   port 8000
  └─ WS    ──► epicsWS               port 8080   (proxied via NGINX as /ws/ in prod)
                └─ EPICS CA / PVA
```

Three services in Docker:

| Service               | Path               | Purpose                          |
| --------------------- | ------------------ | -------------------------------- |
| `weiss` / `weiss-dev` | `/` (Vite + NGINX) | Frontend SPA                     |
| `weiss-api`           | `backend/api/`     | FastAPI: auth, Git repo CRUD     |
| `weiss-epicsws`       | `backend/epicsWS/` | Python WebSocket bridge to EPICS |

---

## Frontend

**Stack:** React 19, TypeScript 5.8, Vite 7, MUI 7, Zustand, react-rnd, react-router-dom 7,
Plotly.js, `@hey-api/openapi-ts` (generated API client).

**Path aliases** (configured in `vite.config.ts`):

- `@src` → `src/`
- `@components` → `src/components/`

### Entry Point

`src/main.tsx` bootstraps the app inside `BrowserRouter`. Routes:

- `/login` → `LoginPage`
- `/auth/callback` → `AuthCallback`
- `/` → `ProtectedRoute` → `App`

`ContextProvider` (`src/context/ContextProvider.tsx`) wraps the entire app and composes four context
providers in three explicit layers (Widget → EPICS → UI).

### State Management

Global state is split between React context (for UI/widget/WS lifecycle) and a Zustand store (for
live PV data). Four context providers are composed inside a single `ContextProvider` in three
explicit layers (Widget → EPICS → UI):

| Context            | Hook               | What it owns                                                                                |
| ------------------ | ------------------ | ------------------------------------------------------------------------------------------- |
| `WidgetContext`    | `useWidgetManager` | All widgets on the canvas, selection, undo/redo, clipboard, grouping, import/export         |
| `UIContext`        | `useUIManager`     | Edit/runtime mode toggle, auth state, repo tree, file open/save, drag/pan flags             |
| `EpicsWSContext`   | `useEpicsWS`       | WebSocket lifecycle and connection state; memoized on `wsConnected` only                    |
| `WSActionsContext` | `useEpicsWS`       | Exposes only `writePVValue`; stable (empty dep array) so write-only widgets never re-render |

Live PV data is **not** in React context. It lives in a [Zustand](https://zustand.pmnd.rs/) store
(`usePVStore` in `src/services/pvStore.ts`). `useEpicsWS` writes incoming updates via
`usePVStore.getState().setPVs()`, batched on `requestAnimationFrame` (~60 fps cap). Widget
components consume PV data by calling `usePVStore(selector)` with a PV-specific selector, so they
re-render only when their own PV changes — not on every update across the system.

#### `useWidgetManager` — mutation discipline

- `editorWidgets: Widget[]` — flat list; the grid is always `editorWidgets[0]` with
  `id === GRID_ID`.
- **All mutations go through** `updateEditorWidgetList(newWidgets, keepHistory)` — this is the
  single mutation point and pushes to the undo stack.
- `updateWidgetProperties(id, updates)` and `batchWidgetUpdate(multiUpdates)` are convenience
  wrappers around `updateEditorWidgetList`.
- Undo/redo via `undoStack`/`redoStack` (capped at `MAX_HISTORY`).
- `formatWdgToExport()` / `loadWidgets()` for serialization.

#### `useEpicsWS`

- Manages the WebSocket connection lifecycle (`ws`, `wsConnected`, `startNewSession`,
  `stopSession`).
- Writes incoming PV updates to the Zustand `usePVStore`, batched per animation frame — no React
  state involved, so PV ticks cause zero re-renders at the context level.
- `writePVValue(pvName, value)` — sends a write message; exposed via `WSActionsContext` so
  write-only widgets don't re-render on connection state changes.

#### `useUIManager`

- `mode: "edit" | "runtime"` — drives whether widgets are interactive or editable.
- `user: User | null`, `isAuthenticated`, `isDeveloper` — auth state; developer role gates staging
  API.
- `reposTreeInfo` — fetched staging or deployment tree depending on role.
- Auto-saves to a staging repo file on property changes (debounced).

### Widget System

Every widget is a `WidgetDefinition` object:

```ts
export interface WidgetDefinition {
  widgetName: string; // registry key / serialization key
  widgetLabel: string; // palette display name
  widgetIcon?: WidgetIconType;
  component: React.ComponentType<WidgetUpdate>; // rendering component
  category: string; // palette grouping
  defaultProperties: WidgetProperties;
}
```

Runtime instances are `Widget` objects (stored in `editorWidgets`):

```ts
export interface Widget {
  id: string;
  widgetName: string;
  editableProperties: WidgetProperties; // subset of PROPERTY_SCHEMAS entries
  children?: Widget[]; // for groups / EmbeddedDisplay
  pvData?: PVData; // merged at render time only
  multiPvData?: Record<string, PVData>;
}
```

`WidgetProperties` is `Partial<typeof PROPERTY_SCHEMAS>` — each key maps to a `WidgetProperty<T>`.

#### Property System

All properties are defined in `src/types/widgetProperties.ts` via `PROPERTY_SCHEMAS`. Each property
has:

- `selType` — which editor control renders it (`"text"`, `"number"`, `"boolean"`, `"colorSel"`,
  `"select"`, `"strList"`, `"strRecord"`, `"repoFile"`, `"none"`)
- `label`, `value`, `category`, optional `options` and `limits`

Pre-built reusable sets (import from `widgetProperties.ts`):

| Export         | Properties included                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `COMMON_PROPS` | `x`, `y`, `width`, `height`, `tooltip`, `visible`, `borderColor`, `borderWidth`, `borderRadius`, `borderStyle`, `backgroundColor` |
| `TEXT_PROPS`   | `textColor`, `fontSize`, `fontFamily`, `fontBold`, `fontItalic`, `fontUnderlined`, `textHAlign`, `textVAlign`                     |
| `PLOT_PROPS`   | `pvNames`, `plotTitle`, `xAxisTitle`, `yAxisTitle`, `lineColors`, `logscaleY`                                                     |

#### Rule System (Property-Oriented)

- Rules are property-oriented: one rule targets exactly one `targetProperty`.
- Each rule contains ordered `rulesets` (condition branches). Each ruleset has:
  - `conditionLogic` (`AND`/`OR`),
  - a list of `conditions` (`pvName`, operator, value),
  - a resulting `value` for the target property.
- Evaluation precedence:
  - inside one rule, the **last matching ruleset wins**,
  - across rules, **later rules win** for the same target property.
- Runtime-only fields (`id`, branch `id`, branch `pvNames`) are reconstructed at load time.
- `.opi.json` exports use the new rule schema. Import remains backward-compatible with the legacy
  action-map format and converts legacy rules into one-property rules at load time.

#### Creating a New Widget

1. Create `src/components/Widgets/<Name>/` folder.
2. `<Name>Comp.tsx` — the React component with signature `React.FC<WidgetUpdate>`:
   - Access props via `data.editableProperties`; conventionally aliased as
     `const p = data.editableProperties`.
   - Access PV data via `data.pvData` / `data.multiPvData` (injected at render time by
     `WidgetRenderer`).
   - Use `const { inEditMode } = useUIContext()` to conditionally alter edit-time rendering.
3. `<Name>.ts` — the `WidgetDefinition` export, e.g.:
   ```ts
   export const MyWidget: WidgetDefinition = {
     component: MyWidgetComp,
     widgetName: "MyWidget",
     widgetIcon: SomeMuiIcon,
     widgetLabel: "My Widget",
     category: "Monitoring", // or "Control", "Display", etc.
     defaultProperties: {
       ...COMMON_PROPS,
       pvName: PROPERTY_SCHEMAS.pvName,
       // add more from PROPERTY_SCHEMAS or define inline
     },
   };
   ```
4. `index.ts` — `export { MyWidget } from "./MyWidget";`
5. Add the export to `src/components/Widgets/index.ts`.
6. The widget is automatically picked up by `WidgetRegistry` and appears in the palette.

#### Widgets that dynamically load another `.opi.json` file

`EmbeddedDisplay` and `NavigationTabs` (category `"Layout"`) both load a linked display file at
render time and inject its (scaled, macro-substituted) widget tree as `data.children` via
`updateWidgetChildren` — the file is never authored by dragging widgets onto the canvas. Shared
fetch/scale/macro logic lives in `src/components/Widgets/shared/embeddedContent.ts`
(`fetchDisplayContent`, `applyDisplayLayout`, `exportedToWidget`, `scaleWidgets`,
`resolveDisplayMacros`, `macrosToKey`) and `src/components/Widgets/shared/Placeholder.tsx`; reuse
these for any future widget with the same pattern instead of duplicating the fetch/cache logic. Any
widget following this pattern must be special-cased (alongside `EmbeddedDisplay`) in the few places
that assume dynamically-injected children are not part of the authored tree: `WidgetRenderer.tsx`
(`childIsEmbedded`), `useWidgetManager.ts` (`ungroupSelected`, `formatWdgToExport`), and
`WidgetTree.tsx` (`buildLayerItems`).

### OPI File Format

Saved as `.opi.json` — an array of `ExportedWidget`:

```json
[
  { "id": "__grid__", "widgetName": "GridZone", "properties": { ... } },
  { "id": "uuid", "widgetName": "TextUpdate", "properties": { "pvName": "...", ... } }
]
```

`NEW_FILE_CONTENT` in `backend/api/src/api/repos/common.py` defines the blank template.

### API Client

`src/services/APIClient/` is **generated** by `@hey-api/openapi-ts` — do not edit manually.
Regenerate after backend changes (API must be running on `:8000`):

```bash
pnpm exec openapi-ts
```

Config: `openapi-ts.config.ts`. Custom fetch with credentials and error handling:
`src/hey-api-fetch.ts`.

### Auth Flow (Frontend)

`AuthService` in `src/services/AuthService/AuthService.ts` drives the login lifecycle:

1. `AuthCallback` route exchanges the OAuth code via `POST /api/v1/auth/callback`.
2. Session cookie (`weiss_session`) is set by the backend (HTTP-only).
3. `authService.restoreSession()` fetches `/api/v1/auth/me` on load.
4. `ProtectedRoute` redirects to `/login` if unauthenticated.

Roles: `"developer"` (full CRUD on staging repos) | `"operator"` (read-only, deployed repos).

---

## Backend API

**Stack:** Python ≥ 3.12, FastAPI, Uvicorn, Authlib + generic OAuth/OIDC provider loading, Pydantic
v2.

**Entry:** `backend/api/src/api/main.py`.

### Router Structure

| Router            | Prefix                  | Auth guard          | Purpose                                         |
| ----------------- | ----------------------- | ------------------- | ----------------------------------------------- |
| `auth.router`     | `/api/v1/auth`          | varies              | Login, callback, me, logout, session management |
| `staging.router`  | `/api/v1/repos/staging` | `require_developer` | Git repo CRUD, file edit, commit/push, deploy   |
| `deployed.router` | `/api/v1/repos/runtime` | `get_current_user`  | Read deployed snapshots / trees                 |

### Auth & Roles

- `get_current_user(request)` — reads `weiss_session` cookie → `User`.
- `require_developer` — `Depends(get_current_user)` + role check.
- Sessions and users stored in-memory (marked for DB replacement).
- Roles defined in `roles.toml` (env var `ROLES_CONFIG_FILE`). Hot-reload:
  `POST /api/v1/auth/admin/reload-roles`.
- Demo mode (`DEMO_MODE=true`): only the `demo` provider is enabled.
- Non-demo auth provider is selected by `AUTH_IDENTITY_PROVIDER` (default `oauth`) and loaded from
  `api.auth.providers`.

### Repo Management

Storage root inside container: `/app/storage/repos/`.  
Each repo directory layout:

```
<repo_id>/
  repo.json           # StagingMeta
  bare/               # bare git clone
  worktrees/<branch>/ # git worktrees for editing
  deployments/
    <snapshot_uuid>/  # immutable deployed snapshot
    current -> <snapshot_uuid>  # symlink to active deploy
```

- **Staging** endpoints manage the `bare` clone + worktrees, allow file browse, read, write, commit,
  push, deploy.
- **Runtime/deployed** endpoints serve the `current` snapshot tree to operators.
- Allowed file extensions: `.opi.json`, `.svg`, `.png`, `.jpg`, `.jpeg`.
- **Files/folders with a `_` prefix** are visible in Edit mode but hidden in Runtime mode — useful
  for shared symbol libraries or templates that operators should not see.
- Git operations run via `subprocess` with optional HTTP Basic auth token
  (`TECHNICAL_ACCOUNT_TOKEN`).

### Adding a New API Endpoint

1. Add the route to the appropriate router (`auth.py`, `staging.py`, or `deployed.py`), or create a
   new router and include it in `main.py`.
2. Define Pydantic models for request/response bodies.
3. Use `Depends(get_current_user)` for authentication; `Depends(require_developer)` for
   developer-only routes.
4. Every endpoint needs a unique `operation_id` (used by the OpenAPI-TS client generator).
5. After changes, regenerate the frontend client (see above).

### Environment Variables

All runtime configuration is provided via the `.env` file at the repository root (copy
`.env.example`).

See docs/src/production/env_variables.md for a full list of environment variables and their
descriptions.

---

## epicsWS Service

**Stack:** Python, `websockets`, `p4p` (PVA), `PyEpics` (CA).

Runs a WebSocket server on port 8080. Clients send JSON messages:

```json
{ "type": "subscribe",   "pv": "MY:PV:NAME" }
{ "type": "unsubscribe", "pv": "MY:PV:NAME" }
{ "type": "write",       "pv": "MY:PV:NAME", "value": 42 }
```

Server pushes `WSMessage` updates (full type in `src/types/epicsWS.ts`):

```json
{ "type": "update", "pv": "MY:PV:NAME", "value": ..., "timeStamp": {...}, "alarm": {...}, "display": {...}, "control": {...}, "valueAlarm": {...}, "enumChoices": [...], "b64arr": "...", "b64dtype": "..." }
```

All fields except `type`, `pv`, `value`, and `timeStamp` are optional.  
Protocol: prefix `pva://` or `ca://`, or set `EPICS_DEFAULT_PROTOCOL`.

---

## Development Commands

```bash
# Frontend only
pnpm install && pnpm dev          # Vite dev server on :5173

# Full stack (docker-compose-dev.yml)
cp backend/api/roles.example.toml roles.toml
docker compose -f docker-compose-dev.yml up --build
# → frontend :5173, API :8000 (/docs for Swagger), epicsWS :8080

# Regenerate API client (API must be running on :8000)
pnpm exec openapi-ts

# Backend tests
cd backend/api && pip install -e ".[dev]" && pytest

# Linting
pnpm lint                          # ESLint + typescript-eslint
cd backend/api && ruff check .     # ruff
```

---

## Key File Locations

| What                        | Where                                             |
| --------------------------- | ------------------------------------------------- |
| Widget definitions          | `src/components/Widgets/<Name>/<Name>.ts`         |
| Widget components           | `src/components/Widgets/<Name>/<Name>Comp.tsx`    |
| Widget registry             | `src/components/WidgetRegistry/WidgetRegistry.ts` |
| All widget property schemas | `src/types/widgetProperties.ts`                   |
| Widget + type definitions   | `src/types/widgets.ts`                            |
| EPICS WS types              | `src/types/epicsWS.ts`                            |
| Global constants / colors   | `src/constants/constants.ts`                      |
| Widget manager hook         | `src/context/useWidgetManager.ts`                 |
| UI manager hook             | `src/context/useUIManager.ts`                     |
| EPICS WS hook               | `src/context/useEpicsWS.ts`                       |
| PV data store (Zustand)     | `src/services/pvStore.ts`                         |
| Per-widget PV rendering     | `src/components/WidgetRenderer/LiveWidget.tsx`    |
| Generated API client        | `src/services/APIClient/` (do not edit manually)  |
| Auth service                | `src/services/AuthService/AuthService.ts`         |
| API entry point             | `backend/api/src/api/main.py`                     |
| Auth routes                 | `backend/api/src/api/auth/auth.py`                |
| Staging routes              | `backend/api/src/api/repos/staging.py`            |
| Deployed routes             | `backend/api/src/api/repos/deployed.py`           |
| Shared repo helpers         | `backend/api/src/api/repos/common.py`             |
| API config (env vars)       | `backend/api/src/api/config.py`                   |
| Roles config loader         | `backend/api/src/api/auth/roles_config.py`        |
| epicsWS server              | `backend/epicsWS/epicsWS.py`                      |
| Dev compose                 | `docker-compose-dev.yml`                          |
| Prod compose                | `docker-compose.yml`                              |

---

## Instructions

- Whenever relevant sections of code are changed, update this file to reflect the new architecture,
  patterns, and conventions.

- Avoid long docstrings in code with detailed examples or explanations. Keep the code
  self-documenting and add comments only for non-obvious logic or decisions.

- Always run `pnpm lint` and `ruff check .` before committing code. Fix all errors and warnings.
