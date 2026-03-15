# Contributing

Contributions are welcome. Feel free to open issues for bug reports, feature requests, or questions.
Pull requests with improvements and new features are also appreciated.

---

## Getting started

Before contributing, read the [Source](source.md) page to learn how to set up your local development
environment using the dev Docker Compose stack.

---

## Code style

The CI pipeline enforces linting and formatting on every push. Make sure your changes pass locally
before opening a pull request.

### Frontend

The frontend uses [ESLint](https://eslint.org/) for linting, [Prettier](https://prettier.io/) for
formatting, and TypeScript for type-checking.

```sh
pnpm eslint .
pnpm prettier --write .
pnpm tsc --noEmit
```

### Backend

The backend uses [Ruff](https://docs.astral.sh/ruff/) for both linting and formatting.

```sh
ruff check backend/
ruff format backend/
```

To fix auto-correctable lint issues in one step:

```sh
ruff check --fix backend/
```

---

## Pull requests

There are no strict rules for pull requests. Keep changes focused and include a clear description of
what was changed and why. The pipeline will run automatically and must pass before merging.
