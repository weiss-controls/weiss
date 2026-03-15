# Architecture

WEISS is split into three independent services that communicate at well-defined boundaries: a React
front-end, a FastAPI back-end, and a dedicated EPICS WebSocket bridge. The block diagram below
illustrates the relationships visually: WIP

---

## Frontend

The frontend is a single-page React application. Its internal structure revolves around two layers:
a shared state layer implemented as React context hooks, and a rendering layer built on top of that
state.

### Context layer (`src/context/`)

Three context providers are composed inside a single `ContextProvider` and made available to the
entire component tree:

- **`useWidgetManager`** — owns the canonical list of widgets on the canvas. It handles selection,
  undo/redo history, clipboard, grouping, and serialisation/deserialisation of OPI files.
- **`useUIManager`** — owns global UI state: the current mode (edit vs. runtime), the open file,
  repository and authentication state, and any cross-cutting user interactions such as loading or
  saving a file.
- **`useEpicsWS`** — manages the WebSocket connection to the EPICS bridge. It subscribes and
  unsubscribes PVs, applies macro substitution, and keeps a live `pvState` map that widgets read in
  runtime mode.

### Rendering layer

- **`GridZoneComp`** — the main editor canvas. It handles drag-and-drop of new widgets, panning,
  zooming, and keyboard shortcuts. It is itself registered as a widget so that its editable
  properties (background, grid size, macros, …) are managed through the same widget pipeline as
  every other widget.
- **`WidgetRenderer`** — iterates the widget list and renders each widget inside a resizable and
  draggable container (`react-rnd`). In runtime mode it merges live PV data from `pvState` into each
  widget before rendering; in edit mode raw widget state is passed directly.

### Widget registry and palette

- **`WidgetRegistry`** — a static mapping from widget name to `WidgetDefinition`. Every widget
  exports a definition object (component reference, label, icon, category, default properties) and
  is re-exported from a single barrel so that the registry is always in sync with the available
  widget set. The registry is the single source of truth consulted by the renderer, the picker, the
  sidebar, and the serialisation logic.
- **`WidgetPicker`** — a collapsible drawer on the left that reads `WidgetRegistry` and groups
  widgets by category. Selecting a widget sets `pickedWidget` in `useWidgetManager`; the next click
  on the canvas instantiates it at that position.

### Editor sidebar

`EditorSidebar` is a collapsible drawer on the right with two tabs:

- **Properties tab** — reads the current selection from `useWidgetContext` and renders a property
  form for the selected widget(s). Property schemas are derived from each widget's
  `WidgetDefinition` so the sidebar always reflects the correct set of controls without any
  per-widget special casing.
- **Projects tab** — surfaces the repository and file tree from `useUIContext`, allowing developers
  to browse registered OPI repositories, open files, and manage commits and deployments without
  leaving the editor.

---

## Backend API

The FastAPI back-end exposes two route groups under `/api/v1/`:

- **`/repos/staging`** — developer-only endpoints (enforced by `require_developer`) that manage
  per-user editable copies of OPI repositories. Each registered repository is cloned as a bare Git
  repository; every developer who opens it gets an isolated **git worktree** created automatically
  for their user ID. This means concurrent edits from different users never interfere with each
  other. Commits, tags, file CRUD, and deployments are all driven through these worktrees via the
  `run_git` helper.
- **`/repos/deployed`** — read-only endpoints used by the frontend in runtime mode to serve the
  currently deployed OPI snapshot to "operator" users.

The API is completely stateless with respect to the frontend: it has no knowledge of active browser
sessions and is only reached through standard HTTP requests made by the generated API client in
`src/services/APIClient/`.

### Authentication

Authentication is handled via OAuth 2.0. The backend supports Microsoft Entra (MSAL) as the identity
provider, as well as a demo mode for local development. On a successful OAuth callback the backend
issues a server-side session cookie. Every subsequent API request is authenticated by resolving that
cookie to a `User` object. Role enforcement (`developer` vs. `operator`) is applied at the route
level using FastAPI dependency injection (`require_developer`).

The frontend delegates all authentication logic to `AuthService`, a singleton that wraps the OAuth
flow and notifies subscribers (primarily `useUIManager`) of status changes.

---

## EPICS WebSocket bridge (`epicsWS`)

The bridge is a standalone Python service that sits between the frontend and the EPICS control
system. It exposes a WebSocket server; the frontend connects to it through `WSClient` and subscribes
to PV names. The bridge supports both Channel Access (`ca://`) and PV Access (`pva://`) protocols,
delegating to the appropriate client (`CAClient` / `PVAClient`). Updates are forwarded to all
subscribed WebSocket clients as JSON messages, including PV metadata on the first message and value
updates thereafter.

This service is intentionally isolated from the API: it has no dependency on authentication or
repository management and can be deployed and scaled independently.
