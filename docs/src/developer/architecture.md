# Architecture

WEISS is split into three main services: a React front-end for user interface and widget rendering,
a FastAPI back-end for handling OPI contents, authentication and git interaction, and a dedicated
EPICS WebSocket bridge. The block diagram below summarizes their interactions:

```{image} ../_static/architecture-dark.svg
:class: only-dark
```

```{image} ../_static/architecture-light.svg
:class: only-light
```

The next sections have a more detailed breakdown of the internal structure of each service and their
interactions.

---

## NGINX

[NGINX](https://nginx.org/) ("engine-x") serves as a reverse proxy for all incoming traffic. It
routes the browser requests to either the frontend, backend API or the EPICS WebSocket internal
ports as needed. Behind NGINX all services run under plain HTTP, being the NGINX layer responsible
for TLS termination, HTTPS support and routing.

## Frontend

The frontend is a single-page React application that operates mainly in two modes: editing
(available for _developer_ role only, see [User Roles](../production/user_roles.md)), and runtime.
In edit mode the user can create and modify widgets on the canvas, while in runtime mode the user
can only interact with the widgets but not change their properties or layout.

Both modes share the same core components. When in runtime, however, the connection to the EPICS
WebSocket is opened, and widgets are rendered through a separate component through which PV Data
traffic is injected.

### Core shared frontend components:

For both modes, the operation and state management of the editor is handled through a combination of
React context providers and custom hooks. For pv state update handling,
[Zustand](https://zustand.site/en/) is used.

:::{important}  
These are not all the shared elements of the frontend composition, but the more important ones.
Starting by these will naturally guide you through the other related files.  
:::

#### State management layer

- **`WidgetContext`** (`useWidgetManager`) - owns the canonical list of widgets on the canvas. It
  handles selection, undo/redo history, clipboard, grouping, and serialisation/deserialisation of
  OPI files.
- **`UIContext`** (`useUIManager`) - owns global UI state: the current mode (edit vs. runtime), the
  open file, repository and authentication state, and any cross-cutting user interactions such as
  loading or saving a file.
- **`EpicsWSContext`** (`useEpicsWS`) - exposes the WebSocket connection state and lifecycle methods
  (`wsConnected`, `startNewSession`, `stopSession`). It does **not** carry live PV data — PV values
  are served by the Zustand `pvStore` described below.
- **`WSActionsContext`** (`useEpicsWS`) - exposes only `writePVValue`. Backed by the same
  `useEpicsWS` hook but kept as a separate context so write-only widgets do not re-render on
  connection state changes.

Live PV data is stored in a [Zustand](https://zustand.pmnd.rs/) module-level store (`usePVStore`,
`src/services/pvStore.ts`). `useEpicsWS` collects incoming WebSocket messages in a buffer and
flushes them into the store via `requestAnimationFrame`, capping updates at ~60 fps. Widget
components subscribe with a PV-specific selector:

```ts
const pvData = usePVStore((state) => state.pvs["MY:PV"]);
```

This means each widget re-renders only when its own PV changes, with no re-render propagation
through React context.

:::{note}  
The state management layer are the brains of the application. All global UI states and behaviors
pass through one of the above.  
:::

#### Rendering layer

- **`GridZoneComp`** - the main editor canvas. It handles drag-and-drop of new widgets, panning,
  zooming, and keyboard shortcuts. It is itself registered as a widget so that its editable
  properties (background, grid size, macros, …) are managed through the same widget pipeline as
  every other widget.
- **`WidgetRenderer`** - iterates the widget list and renders each widget inside a resizable and
  draggable container (`react-rnd`). It either renders the static component directly (editMode), or
  delegates it to`LiveWidget`if in runtime.
- **`LiveWidget`** - operates in runtime mode only. Subscribes to `usePVStore` with a PV-specific
  selector (using `useShallow` for reference equality), then calls `applyWidgetPVData()`
  (`widgetRenderUtils.ts`) to merge PV data, evaluate configured rules, and resolve macros before
  rendering the widget component.

#### Services

- **`APIClient`** - auto-generated TypeScript client produced by `@hey-api/openapi-ts` from the
  FastAPI OpenAPI schema. Provides type-safe wrappers for all backend REST endpoints (auth, repo
  CRUD, file read/write, Git operations).

  :::{warning} Do not edit this folder manually. Regenerate it with `pnpm exec openapi-ts` after any
  backend endpoint changes (API must be running on `:8000`). :::

- **`AuthService`** - singleton (`authService`) that drives the full OAuth login lifecycle. Handles
  provider redirect, code exchange, session restoration on page load (`restoreSession()`), and
  logout. Broadcasts auth state changes to React via a callback observer consumed by `useUIManager`.

- **`Dialog`** - imperative confirmation dialog. Call `confirmDialog(options)` from anywhere in the
  app to open a modal; it returns a `Promise<boolean>` resolved when the user confirms or cancels.

  :::{note} `<DialogService />` must be mounted once in the component tree (currently in `App.tsx`)
  to register the underlying handler. The same applies to `<NotificationService />` below. :::

- **`Notifications`** - fire-and-forget toast notifications. Call `notifyUser(message, severity?)`
  to display a 4-second auto-dismiss snackbar. Accepted severity values: `"success"`, `"info"`,
  `"warning"`, `"error"`.

- **`WSClient`** - stateful WebSocket class injected into `useEpicsWS`. Manages
  subscribe/unsubscribe/write messaging to the EPICS bridge, auto-reconnects with exponential
  backoff on unexpected disconnection, and decodes base64-encoded binary arrays before data reaches
  `pvStore`.

- **`pvStore`** - Zustand store for live EPICS PV data. See the
  [State management layer](#state-management-layer) section above for a full description.

---

## Backend

### API

The FastAPI back-end exposes three route groups:

- **Developer routes** (`/repos/staging`): developer-only endpoints (enforced by
  `require_developer`) that manage per-user editable copies of OPI repositories. Each registered
  repository is cloned as a bare Git repository; every developer who opens it gets an isolated **git
  worktree** created automatically for their user ID. This means concurrent edits from different
  users never interfere with each other. Commits, tags, file CRUD, and deployments are all driven
  through these worktrees via their respective endpoints. For interaction with remote, the Technical
  Account Token is used. See [Git Interaction](../production/git_interaction.md) for more details.

- **Operator routes** (`/repos/deployed`): read-only endpoints used by the frontend to serve the
  currently deployed OPI snapshot to "operator" users.

- **Snapshot routes** (`/repos/snapshot`): provides **storage interaction** with PV snapshots
  (saving to disk, fetching values, etc.). These endpoints **DO NOT** communicate to PVs in any
  form, i.e., you need to provide the data to be saved, and for restoring, you need to restore it
  yourself (WEISS frontend does that). This will change as the snapshot feature becomes a standalone
  service.

#### Authentication

Authentication is based on OAuth 2.0 system, and is available through the `/auth` route group. At
the moment only authentication via Microsoft Identity Platform is supported
([MSAL](https://learn.microsoft.com/en-us/entra/identity-platform/msal-overview)), but the
architecture allows for multiple authentication providers to be added in the future as needed.

:::{note}  
Auth workflow details to be provided.  
:::

---

### EPICS WebSocket bridge (`epicsWS`)

`epicsWS` is a standalone Python WebSocket service that sits between the frontend and the EPICS
IOCs. The frontend connects to it through `WSClient` and subscribes to PV names based on the widgets
present on the canvas.

- The PVA library used is [p4p](https://github.com/epics-base/p4p/), see
  `backend/epicsWS/PVAClient`.
- The CA library used is [PyEpics](https://pyepics.github.io/pyepics/), see
  `backend/epicsWS/CAClient`.

The web socket application and connection manager can be seen in `backend/epicsWS/epicsWS`. The
concept was based on [ORNL PV Web Socket (PVWS)](https://github.com/ornl-epics/pvws).

#### How it works

Based on the default protocol (see [Environment Variables](../production/env_variables.md)) or the
channel prefix of the PV names (e.g `pva://` or `ca://`), the WS chooses the correct provider.

The incoming messages from all origins are parsed through a common interface defined on `pvParser`
source file. This results in a standard structure in the format of the `PVData` class, regardless of
the origin of the message.

This class was based on the
[EPICS Normative Types](https://docs.epics-controls.org/projects/normativetypes-cpp/en/latest/ntCPP.html)
(with minor modifications for convenience). This way, a known format is always used, and the
front-end client only needs to know one data structure for all protocols. Similar to PVWS, **extra
fields were added for base64 encoding** for arrays, improving JSON data traffic. A separate field
for enumeration strings for enum/enum-like records was also added.

This service is intentionally isolated from the API: it has no dependency on authentication or
repository management and can be deployed and scaled independently.

Further tests on performance and scalability are planned for the near future.
