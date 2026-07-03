# Contributing

Contributions are welcome. Feel free to open issues for bug reports, feature requests, or questions.
Pull requests with improvements and new features are also appreciated.

Source code: https://github.com/weiss-controls/weiss/

---

## Getting started

Before contributing, read the [Source](source.md) page to learn how to set up your local development
environment using the dev Docker Compose stack.

---

## Opening issues

### Reporting a problem

When reporting bugs, try to be as descriptive as possible. Avoid "X feature doesn't work", and
prefer, instead, to include:

- What is the problem;
- In which situation it appears;
- Steps to reproduce;
- Screenshots or screen recordings (if applicable);
- Details of your system (just OS and browser used is enough).

### Requesting a feature

Similarly, rich details of the wanted feature help the developers to better implement it. Prefer to
include:

- A description of what is needed;
- Example of use cases;
- References if applicable (does a similar feature exist in other system already?);

## Opening pull requests

There are no strict rules for pull requests, however, some basic guidelines are required:

- If you have different scopes to propose changes, open different pull requests.
- Keep commit history clean: avoid several commits for the same feature;
- Separate each significant change into its own commit;
- Submit meaningful commit messages - this facilitates debugging and understanding the history in
  the future.
- Make sure all pipelines are passing before requesting a review - feel free to ask for assistance
  as needed.

---

## Code style

The CI pipeline enforces linting and formatting on every push. Make sure your changes pass locally
before opening a pull request.

### Frontend

The frontend uses [Oxlint](https://oxc.rs/) for linting, [Prettier](https://prettier.io/) for
formatting, and TypeScript for type-checking. Make sure to run the following commands before
pushing, so you avoid pipeline errors:

```sh
pnpm run lint
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

## Working on the API

If submitting a new feature or route for the API, make sure to:

- Properly group the associated routes in a semantic way (see other routes for example);
- Give a meaningful, unique `operation_id` name for the route. It will be used to create the name of
  the function on the client side (see next topic).
- Make sure to **update the API Client for the frontend**:
  - The API Client (src/services/APIClient) is automatically generated using
    [hey-api](https://heyapi.dev/). After updating the API, make sure the latest version is running,
    then, from the top of the repo, run:
    ```sh
    pnpm exec openapi-ts
    ```
    The service will fetch the OpenAPI specs from your updated code, then update the client
    accordingly. Submit both changes on a single commit for consistency.
