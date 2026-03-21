# Mount the source code

The development version mounts the source code so you can see live changes while coding. It also
provides a demoioc for convenience.

Run:

```sh
docker compose -f docker-compose-dev.yml up
```

This launches four services:

- `weiss-epicsws-dev`: the EPICS communication layer.
- `weiss-api-dev`: the backend API for file and git interaction.
- `weiss-dev`: The WEISS front-end application. It should be accessible in `http://localhost:5173`.

> For the API, the service must be restarted for endpoint changes to take effect. `DEV_MODE` is
> already set to `true` in `docker-compose-dev.yml`, so the API automatically allows requests from
> `http://localhost:5173` — no extra configuration is needed.

---

## Building and serving the documentation

The documentation is built and served independently from the main stack using its own Compose file
under `docs/`:

```sh
docker compose -f docs/docker-compose.yml up -d --build
```

This builds the Sphinx documentation and serves the resulting HTML via nginx on
`http://localhost:8001`.

The docs service is completely standalone and has no dependency on the main stack. To expose it
publicly under a dedicated hostname (e.g. `docs.example.com`), set `DOCS_HOSTNAME` in your `.env`
and ensure the main `weiss` service is running — it will automatically proxy requests for that
hostname to the docs container. See [Environment variables](../production/env_variables.md) for
details.
