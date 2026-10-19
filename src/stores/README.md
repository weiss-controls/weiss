# Stores

Shared app state, one [Zustand](https://zustand.pmnd.rs/) store per concern. Component-local state
(zoom/pan, dialogs, drag-and-drop state of a single component) stays in the component.

## Conventions

- Create stores with plain `create()`. Add `subscribeWithSelector` only when the store drives side
  effects through `store.subscribe`.
- `devtools` is enabled in dev builds only, with `enabled: import.meta.env.DEV` in its options. It
  serializes the whole state on every action, so it is not used on stores that hold large or
  fast-changing data (`editorStore`, `pvStore`, `imageStore`).
- Components subscribe with a selector for the smallest slice they need. A selector returns a
  primitive or a reference stored in the state; arrays and objects built inside a selector need
  `useShallow` (Zustand 5 loops on a new snapshot per call).
- Event handlers read actions and current values with `useXStore.getState()` and do not subscribe.
- Derived state is computed inside actions and stored, not recomputed in hooks.
- Actions that touch several stores live in `actions.ts` as plain functions.
- Effects that need the React lifecycle (auth subscription, file fetch, auto-save, WS reconnect)
  live in `<AppEffects />`. Store-to-store reactions use `store.subscribe` next to the store.
