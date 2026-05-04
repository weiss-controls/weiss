<!---
This file provides a general overview of the WEISS project architecture,
key components, and development setup. It is intended especially for AI
assisted development, or new developers onboarding, for a quick
understanding of the codebase structure without having to read through
the entire documentation.
-->

# WEISS — Project Context

WEISS is a web-based EPICS OPI (Operator Interface) designer and runtime viewer. It lets
control-system engineers design display panels (OPIs) in a browser, store them in Git repositories,
and serve them live with real-time EPICS PV data via WebSocket.

License: GPL-3.0-or-later. All source files carry the header:

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

**Stack:** React 19, TypeScript 5.8, Vite 7, MUI 7, react-rnd, react-router-dom 7, Plotly.js,
`@hey-api/openapi-ts` (generated API client).

**Path aliases** (configured in `vite.config.ts`):

- `@src` → `src/`
- `@components` → `src/components/`

### Entry Point

`src/main.tsx` bootstraps the app inside `BrowserRouter`. Routes:

- `/login` → `LoginPage`
- `/auth/callback` → `AuthCallback`
- `/` → `ProtectedRoute` → `App`

`ContextProvider` wraps the entire app and initialises the three main managers.

### State Management (Context)

All state lives in React context — no Redux. Three providers:

| Context                               | Hook               | What it owns                                                                        |
| ------------------------------------- | ------------------ | ----------------------------------------------------------------------------------- |
| `WidgetContext`                       | `useWidgetManager` | All widgets on the canvas, selection, undo/redo, clipboard, grouping, import/export |
| `EpicsWSContext` + `WSActionsContext` | `useEpicsWS`       | WebSocket lifecycle, PV subscriptions, `pvState` cache, macro substitution map      |
| `UIContext`                           | `useUIManager`     | Edit/runtime mode toggle, auth state, repo tree, file open/save, drag/pan flags     |

#### `useWidgetManager`

- `editorWidgets: Widget[]` — flat list; grid is always `editorWidgets[0]` with `id === GRID_ID`.
- `updateEditorWidgetList(newWidgets, keepHistory)` — the single mutation point; pushes to undo
  stack.
- `updateWidgetProperties(id, updates)` and `batchWidgetUpdate(multiUpdates)` for property edits.
- Undo/redo via `undoStack`/`redoStack` (capped at `MAX_HISTORY`).
- `formatWdgToExport()` / `loadWidgets()` for serialization.

#### `useEpicsWS`

- Maintains a `WSClient` (WebSocket) connected to the epicsWS service.
- `PVMap: Map<originalPV, substitutedPV>` — macro substitution lives here, computed by
  `useWidgetManager`.
- `pvState: Record<pvName, PVData>` — reactive PV data fed to widget renders.
- `writePVValue(pvName, value)` — sends a write message.

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

Pre-built reusable sets: `COMMON_PROPS`, `TEXT_PROPS` (import from `widgetProperties.ts`).

#### Creating a New Widget

1. Create `src/components/Widgets/<Name>/` folder.
2. `<Name>Comp.tsx` — the React component with signature `React.FC<WidgetUpdate>`:
   - Access props via `data.editableProperties` (aliased as `p`).
   - Access PV data via `data.pvData` / `data.multiPvData`.
   - Check `inEditMode` from `useUIContext()` to alter edit-time rendering.
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

Generated by `@hey-api/openapi-ts` from `http://localhost:8000/openapi.json` into
`src/services/APIClient/`. Regenerate with:

```
pnpm run generate  # or: npx openapi-ts
```

Config lives in `openapi-ts.config.ts`.  
Custom fetch (credentials: include, error handling) is in `src/hey-api-fetch.ts`.

### Auth Flow (Frontend)

`AuthService` in `src/services/AuthService/AuthService.ts` drives the login lifecycle:

1. `AuthCallback` route exchanges the OAuth code via `POST /api/v1/auth/callback`.
2. Session cookie (`weiss_session`) is set by the backend (HTTP-only).
3. `authService.checkAuth()` fetches `/api/v1/auth/me` on load.
4. `ProtectedRoute` redirects to `/login` if unauthenticated.

Roles: `"developer"` (full CRUD on staging repos) | `"operator"` (read-only, deployed repos).

---

## Backend API

**Stack:** Python ≥ 3.12, FastAPI 0.126, Uvicorn, MSAL (Microsoft OAuth), Authlib, httpx, Pydantic
v2.

**Entry:** `backend/api/src/api/main.py` — creates `FastAPI` app, registers middleware, routers.

### Router Structure

| Router            | Prefix                  | Auth guard          | Purpose                                         |
| ----------------- | ----------------------- | ------------------- | ----------------------------------------------- |
| `auth.router`     | `/api/v1/auth`          | varies              | Login, callback, me, logout, session management |
| `staging.router`  | `/api/v1/repos/staging` | `require_developer` | Git repo CRUD, file edit, commit/push, deploy   |
| `deployed.router` | `/api/v1/repos/runtime` | `get_current_user`  | Read deployed snapshots / trees                 |

### Auth

- Microsoft OAuth 2.0 via MSAL (`ConfidentialClientApplication`).
- Demo mode: a `"demo"` provider creates a fake session without MSAL.
- Sessions stored in-memory (`sessions: dict[str, Session]`). A background task prunes expired
  sessions every hour.
- `get_current_user(request)` — reads `weiss_session` cookie, resolves `User`.
- `require_developer` — `Depends(get_current_user)` + role check.

**Users** also live in-memory (`users_db`). This is explicitly marked for replacement with a DB.

### Roles

`roles.toml` (mounted read-only at `/config/roles.toml`) lists developer usernames. Everyone else is
operator. See `backend/api/roles.example.toml` for format.

Hot-reload: `POST /api/v1/auth/admin/reload-roles` (developer only).

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

### Environment Variables (API)

| Variable                     | Required          | Default             | Description                          |
| ---------------------------- | ----------------- | ------------------- | ------------------------------------ |
| `MS_AUTH_CLIENT_ID`          | Yes (for MS auth) | —                   | Azure App Registration client ID     |
| `MS_AUTH_CLIENT_SECRET`      | Yes (for MS auth) | —                   | Client secret                        |
| `MS_AUTH_TENANT_ID`          | No                | `"common"`          | Azure tenant                         |
| `APP_HOSTNAME`               | No                | `"localhost"`       | Used to derive CORS allowed origin   |
| `ENABLE_HTTPS`               | No                | `false`             | HTTPS mode                           |
| `DEV_MODE`                   | No                | `false`             | Appends Vite dev port to CORS origin |
| `TECHNICAL_ACCOUNT_TOKEN`    | No                | —                   | Git HTTP auth token for push         |
| `TECHNICAL_ACCOUNT_USERNAME` | No                | `"weiss-bot"`       | Git commit author name               |
| `TECHNICAL_ACCOUNT_EMAIL`    | No                | `"weiss-bot@dummy"` | Git commit author email              |
| `ROLES_CONFIG_PATH`          | No                | `./roles.toml`      | Path to roles TOML                   |

---

## epicsWS Service

**Stack:** Python, `websockets`, `p4p` (PVA), `aioca` (CA).

Runs a WebSocket server on port 8080. Clients send JSON messages:

```json
{ "type": "subscribe",   "pv": "MY:PV:NAME" }
{ "type": "unsubscribe", "pv": "MY:PV:NAME" }
{ "type": "write",       "pv": "MY:PV:NAME", "value": 42 }
```

Server pushes updates:

```json
{ "pv": "MY:PV:NAME", "value": ..., "alarm": {...}, "display": {...}, "timeStamp": {...} }
```

Protocol selection: prefix `pva://` or `ca://` on the PV name, or set `EPICS_DEFAULT_PROTOCOL`.

---

## Development Setup

### Frontend only

```bash
pnpm install
pnpm dev          # Vite dev server on :5173
```

### Full stack (Docker Compose)

```bash
cp backend/api/roles.example.toml roles.toml
# fill in .env with MS_AUTH_* vars, EPICS_CA_ADDR_LIST, etc.
docker compose -f docker-compose-dev.yml up --build
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000` (also exposes `/docs` for Swagger UI)
- epicsWS: `ws://localhost:8080`

### Regenerate API client (after backend changes)

```bash
# API must be running on :8000
pnpm exec openapi-ts   # or: npx openapi-ts
```

### Backend tests

```bash
cd backend/api
pip install -e ".[dev]"
pytest
```

### Linting / formatting

- Frontend: `pnpm lint` (ESLint + typescript-eslint), `prettier`
- Backend: `ruff` (linting + formatting), `mypy` (type checking)

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

## Known Improvement Points

### Backend

- **In-memory session and user stores** — `users_db` and `sessions` in `auth.py` are plain dicts.
  Restart invalidates all sessions; no horizontal scaling. Marked in code for DB replacement.
- **`REPOS_BASE_PATH` hardcoded outside config** — defined in `common.py` instead of `config.py`;
  should be env-configurable.
- **Git via subprocess** — fragile error handling; path/branch inputs should be validated carefully
  to prevent injection. Consider `gitpython` or `pygit2`.
- **`NEW_FILE_CONTENT` mutable module-level list** — any in-place mutation corrupts future new
  files. Should be a factory function.
- **`TECHNICAL_ACCOUNT_TOKEN` read at import time** — token rotation requires a full restart.
- **epicsWS has no auth** — port 8080 accepts any connection. Fine behind NGINX in prod but fully
  open in dev.
- **Demo mode backend bypass** — `VITE_DEMO_MODE` only hides the UI button; the
  `/api/v1/auth/demo/authorize` endpoint is always reachable. A backend `ENABLE_DEMO_MODE` env var
  (default `false`) should guard the demo auth routes.

### Frontend

- **`pvData` / `multiPvData` on `Widget` type** — render-time concerns leaking into the data model.
  These fields could belong in a separate render-only type.
- **Manual memoization in `WidgetRenderer`** — `prevWidgetsMapRef` + `prevPVStateRef` diffing is
  complex to maintain and may not scale well at high widget counts or PV update rates.
- **Hybrid flat + nested widget tree** — top-level is a flat array, groups have `children`. A fully
  normalized structure (map by ID with parent/child ID refs) would simplify traversal helpers.
- **Generated API client tracked in git** — `src/services/APIClient/` produces noisy diffs on every
  backend change. Could be generated in CI and gitignored. If this path is chosen, a stable way of
  always having the latest API client available in development would be needed.

### Cross-cutting

- **Version injection fails without git** — `vite.config.ts` calls `git describe` via `execSync`;
  hard-fails in environments without a git repo. Needs a try/catch fallback.
- **No integration tests for git layer** — the staging repo operations (clone, worktree, commit,
  deploy) are the most complex and side-effectful backend code, and the least likely to be covered
  by unit tests alone.
