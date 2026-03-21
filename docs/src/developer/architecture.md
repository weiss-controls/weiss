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

Both modes share the same widget renderer and core components. When in runtime, however, the
connection to the EPICS WebSocket is opened, and PV Data traffic is injected into the widgets

### Beyond the diagram - core frontend components:

For both modes, the operation and state management of the editor is handled through a combination of
React context providers and custom hooks. The main layers are:

#### Context layer (`src/context/`)

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

#### Rendering layer

- **`GridZoneComp`** — the main editor canvas. It handles drag-and-drop of new widgets, panning,
  zooming, and keyboard shortcuts. It is itself registered as a widget so that its editable
  properties (background, grid size, macros, …) are managed through the same widget pipeline as
  every other widget.
- **`WidgetRenderer`** — iterates the widget list and renders each widget inside a resizable and
  draggable container (`react-rnd`). In runtime mode it merges live PV data from `pvState` into each
  widget before rendering; in edit mode raw widget state is passed directly.

#### Widget registry and palette

- **`WidgetRegistry`** — a static mapping from widget name to `WidgetDefinition`. Every widget
  exports a definition object (component reference, label, icon, category, default properties) and
  is re-exported from a single barrel so that the registry is always in sync with the available
  widget set. The registry is the single source of truth consulted by the renderer, the picker, the
  sidebar, and the serialisation logic.
- **`WidgetPicker`** — a collapsible drawer on the left that reads `WidgetRegistry` and groups
  widgets by category. Selecting a widget sets `pickedWidget` in `useWidgetManager`; the next click
  on the canvas instantiates it at that position.

#### Editor sidebar

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

The FastAPI back-end exposes two route groups:

- **Developer routes** (`/repos/staging`): developer-only endpoints (enforced by
  `require_developer`) that manage per-user editable copies of OPI repositories. Each registered
  repository is cloned as a bare Git repository; every developer who opens it gets an isolated **git
  worktree** created automatically for their user ID. This means concurrent edits from different
  users never interfere with each other. Commits, tags, file CRUD, and deployments are all driven
  through these worktrees via their respective endpoints. For interaction with remote, the Technical
  Account Token is used. See [Git Interaction](../production/git_interaction.md) for more details.

- **Operator routes** (`/repos/deployed`): read-only endpoints used by the frontend to serve the
  currently deployed OPI snapshot to "operator" users.

### Authentication

Authentication is based on OAuth 2.0 system, and is available through the `/auth` route group. At
the moment only authentication via Microsoft Identity Platform is supported
([MSAL](https://learn.microsoft.com/en-us/entra/identity-platform/msal-overview)), but the
architecture allows for multiple authentication providers to be added in the future as needed.

:::{note}  
Auth workflow details to be provided.  
:::

---

## EPICS WebSocket bridge (`epicsWS`)

`epicsWS` is a standalone Python WebSocket service that sits between the frontend and the EPICS
IOCs. The frontend connects to it through `WSClient` and subscribes to PV names based on the widgets
present on the canvas.

- The PVA library used is [p4p](https://github.com/epics-base/p4p/), see
  `backend/epicsWS/PVAClient`.
- The CA library used is [PyEpics](https://pyepics.github.io/pyepics/), see
  `backend/epicsWS/CAClient`.

The web socket application and connection manager can be seen in `backend/epicsWS/epicsWS`. The
concept was based on [ORNL PV Web Socket (PVWS)](https://github.com/ornl-epics/pvws).

### How it works

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
