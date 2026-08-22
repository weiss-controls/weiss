# Environment variables

All runtime configuration is provided through environment variables in the `.env` file at the root
of the repository. Copy `.env.example` as a starting point:

```sh
cp .env.example .env
```

---

## Frontend build arguments

These are injected at **build time** by Vite and baked into the static bundle. Changing them
requires a rebuild.

In this repository, Compose derives these from server-side variables:

| Build arg                     | Derived from             | Description                                                 |
| ----------------------------- | ------------------------ | ----------------------------------------------------------- |
| `VITE_DEMO_MODE`              | `DEMO_MODE`              | Enables demo login buttons in the frontend login page.      |
| `VITE_AUTH_IDENTITY_PROVIDER` | `AUTH_IDENTITY_PROVIDER` | Enables the non-demo login provider button in the frontend. |

---

## Docker image tagging

| Variable     | Default  | Description                                                                               |
| ------------ | -------- | ----------------------------------------------------------------------------------------- |
| `DOCKER_TAG` | `latest` | Tag applied to all Docker images built by Compose (`weiss`, `weiss-api`, `weiss-epicsws`) |

---

## EPICS settings

Consumed by the `weiss-epicsws` service.

| Variable                   | Default     | Description                                                                                                                                        |
| -------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EPICS_DEFAULT_PROTOCOL`   | `pva`       | Protocol used when a PV name has no `ca://` or `pva://` prefix. Accepted values: `pva`, `ca`.                                                      |
| `EPICS_CA_ADDR_LIST`       | `localhost` | Standard EPICS_CA_ADDR_LIST env variable. See [EPICS docs](https://epics.anl.gov/base/R3-14/12-docs/CAref.html) for reference.                     |
| `EPICS_CA_AUTO_ADDR_LIST`  | `YES`       | Standard EPICS_CA_AUTO_ADDR_LIST env variable. See [EPICS docs](https://epics.anl.gov/base/R3-14/12-docs/CAref.html) for reference.                |
| `EPICS_CA_MAX_ARRAY_BYTES` | `1000000`   | Standard EPICS_CA_MAX_ARRAY_BYTES env variable. See [EPICS docs](https://epics.anl.gov/base/R3-14/12-docs/CAref.html) for reference.               |
| `EPICS_PVA_ADDR_LIST`      | `localhost` | Standard EPICS_PVA_ADDR_LIST env variable. See [EPICS docs](https://docs.epics-controls.org/en/latest/specs/pva_protocol.html) for reference.      |
| `EPICS_PVA_AUTO_ADDR_LIST` | `YES`       | Standard EPICS_PVA_AUTO_ADDR_LIST env variable. See [EPICS docs](https://docs.epics-controls.org/en/latest/specs/pva_protocol.html) for reference. |
| `EPICS_MAX_UPDATE_RATE_HZ` | `30`        | Max rate at which updates for a single PV are forwarded to clients. `0` disables throttling.                                                       |

:::{note}  
To receive PV traffic from IOCs outside of `localhost`, add the IOC host or subnet broadcast address
to the relevant address list. One may also choose to use a PVA or CA gateway as needed. More details
in EPICS docs  
:::

---

## HTTPS settings

Consumed by both `weiss` (nginx) and `weiss-api` (FastAPI CORS and cookie flags).

| Variable        | Default                               | Description                                                                                                                                                                                                                                                  |
| --------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ENABLE_HTTPS`  | `false`                               | Set to true to enable HTTPS and mark session cookies as `Secure`.                                                                                                                                                                                            |
| `SSL_CERT_FILE` | `./nginx/certs/example-fullchain.pem` | Path on the _host_ to the full-chain TLS certificate (PEM). Mounted read-only into the container.                                                                                                                                                            |
| `SSL_KEY_FILE`  | `./nginx/certs/example-privkey.pem`   | Path on the _host_ to the TLS private key (PEM). Mounted read-only into the container.                                                                                                                                                                       |
| `APP_HOSTNAME`  | `localhost`                           | Hostname under which the app is served. Used by nginx `server_name` and to derive the CORS origin for the API. Change this to your server's hostname or IP for any non-localhost deployment.                                                                 |
| `DOCS_HOSTNAME` | _(unset)_                             | Hostname under which the documentation is served. When set, nginx adds a proxy block for it pointing to the docs container (port 8001). Requires [running the docs service](../developer/source.md) separately. Leave unset if you are not serving the docs. |

---

## API settings

Consumed by the `weiss-api` service.

### SSO authentication

Required when `DEMO_MODE=false` or when OAuth login is desired alongside demo mode. See
[Organization credentials](org_credentials.md) for setup instructions.

| Variable                 | Default  | Description                                                                                                        |
| ------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `DEMO_MODE`              | `true`   | When `true`, only the demo provider is enabled in the backend.                                                     |
| `AUTH_CLIENT_ID`         | _(none)_ | Application (client) ID from the client registration.                                                              |
| `AUTH_CLIENT_SECRET`     | _(none)_ | Client secret value from the client registration.                                                                  |
| `AUTH_ISSUER`            | _(none)_ | OAuth2/OpenID Connect issuer URL.                                                                                  |
| `AUTH_IDENTITY_PROVIDER` | `oauth`  | Auth provider module to use for non-demo logins. Must map to a file in `api.auth.providers` (for example `oauth`). |

:::{note}  
For now, the default implementation is generic OAuth2/OIDC (`oauth`), which should cover most common
cases. The architecture supports additional providers via `api.auth.providers`. Any provider
implementation must inherit from `api.auth.providers.generic.GenericProvider`.  
:::

### Technical account (git commits)

Required for commit and push operations from the staging editor. See [Using Git](git_interaction.md)
for setup instructions.

| Variable                     | Default           | Description                                                     |
| ---------------------------- | ----------------- | --------------------------------------------------------------- |
| `TECHNICAL_ACCOUNT_TOKEN`    | _(none)_          | Technical account token (PAT) with repository write permission. |
| `TECHNICAL_ACCOUNT_USERNAME` | `weiss-bot`       | Technical account username. Used for commit history logs        |
| `TECHNICAL_ACCOUNT_EMAIL`    | `weiss-bot@dummy` | Technical account email. Used for commit history logs           |

### User roles

Controls the path of the `roles.toml` file that defines which users have the developer role. See
[User roles](user_roles.md) for full setup instructions.

| Variable            | Default        | Description                                                                                       |
| ------------------- | -------------- | ------------------------------------------------------------------------------------------------- |
| `ROLES_CONFIG_FILE` | `./roles.toml` | Path on the _host_ to the roles config file. Mounted read-only into the API container at startup. |
