# WEISS - Web EPICS Interface & Synoptic Studio

WEISS is a no-code, drag-and-drop system for building web-based EPICS operation interfaces. It
provides a responsive editor, git-based OPI versioning, live PV communication and a lightweight
deployment model.

Try it out: [https://demo.weiss-controls.org](https://demo.weiss-controls.org).

![Example image](_static/example.svg)

---

## Motivation

### Why should you use web?

- **Client-side rendering**: the client browser performs most work; backend load stays minimal.
- **Ease of access**: use any modern browser—no remote desktops or local tools required. Access
  control relies on standard security mechanisms (network restrictions, authentication, reverse
  proxies, etc).
- **Built for scale**: concurrent users do not require dedicated VMs or graphical sessions.
- **Global ecosystem**: web technologies have one of the largest developer ecosystems, offering
  libraries, tools, and best practices beyond the scientific environment niche.
- **Integration friendly**: easy to connect with authentication systems (LDAP), GitHub/GitLab, and
  other modern tools.

---

## Key Features

- **Drag-and-drop editor** with grid snapping, alignment, grouping, layering, keyboard shortcuts.
- **Live EPICS PV communication**: supports both Channel Access (CA) and PV Access (PVA) protocols
  via community-validated implementations [p4p](https://github.com/epics-base/p4p/) and
  [PyEpics](https://pyepics.github.io/pyepics/).
- **Runtime vs edit mode**: instantly start and stop communication with a switch button.
- **Extensible widget library**: ready-to-use components for common controls and displays, others
  can be easily created.
- **Designed for usability** : responsive UI, straightforward layout logic, modern development
  stack.
- **Portable JSON format**: import/export or create OPIs programatically using simple JSON files.

Planned improvements (access control, OPI distribution, repository integration, etc.) are tracked in
the [WEISS Project Dashboard](https://github.com/orgs/weiss-controls/projects/1/).

## Notes

- Some references used for this project:
  - [Taranta](https://gitlab.com/tango-controls/web/taranta),
  - [React Automation Studio](https://github.com/React-Automation-Studio/React-Automation-Studio),
  - [PVWS](https://github.com/ornl-epics/pvws),
  - [pyDM](https://github.com/slaclab/pydm),
  - [Phoebus](https://github.com/ControlSystemStudio/phoebus).

```{toctree}
:maxdepth: 3
:hidden:
:name: getting-started
:caption: Getting Started

getting_started/quickstart
```

```{toctree}
:maxdepth: 3
:hidden:
:name: production-setup
:caption: Production Setup

production/env_variables
production/https
production/org_credentials
production/user_roles
production/git_interaction
```

```{toctree}
:maxdepth: 3
:hidden:
:name: for-devs
:caption: For developers

developer/architecture
developer/contributing
developer/source
developer/creating_widget
```
