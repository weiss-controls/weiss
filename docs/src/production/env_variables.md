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

| Variable           | Default                                       | Description                                                                                                     |
| ------------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `GIT_REPO`         | `https://github.com/weiss-controls/weiss.git` | URL of the WEISS repository used for build (production build will always build from source!).                   |
| `VITE_APP_VERSION` | `0.1.0`                                       | Application version checked out in build time and shown in the UI.                                              |
| `VITE_DEMO_MODE`   | `true`                                        | When `true`, a demo (unauthenticated) login option is shown on the login page. Disable for private deployments. |

---

## EPICS settings

Consumed by the `weiss-epicsws` service.

| Variable                 | Default     | Description                                                                                   |
| ------------------------ | ----------- | --------------------------------------------------------------------------------------------- |
| `EPICS_DEFAULT_PROTOCOL` | `pva`       | Protocol used when a PV name has no `ca://` or `pva://` prefix. Accepted values: `pva`, `ca`. |
| `EPICS_CA_ADDR_LIST`     | `localhost` | Space-separated list of Channel Access address(es) / broadcast addresses.                     |
| `EPICS_PVA_ADDR_LIST`    | `localhost` | Space-separated list of PV Access address(es) / broadcast addresses.                          |

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

### Microsoft Entra ID (SSO authentication)

Required when `VITE_DEMO_MODE=false` or when SSO login is desired alongside demo mode. See
[Organization credentials](org_credentials.md) for setup instructions.

| Variable                | Default  | Description                                                                                                                                |
| ----------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `MS_AUTH_CLIENT_ID`     | _(none)_ | Application (client) ID from the Azure app registration.                                                                                   |
| `MS_AUTH_TENANT_ID`     | `common` | Directory (tenant) ID. Use `common` for multi-tenant or consumer accounts, or the specific tenant ID to restrict to a single organisation. |
| `MS_AUTH_CLIENT_SECRET` | _(none)_ | Client secret value from the Azure app registration.                                                                                       |

:::{note}  
For now, only Microsoft Entra ID authentication method is supported, but the architecture allows for
multiple providers to be added as needed. If you need a different authentication method, please open
an issue or, better yet, contribute a provider implementation!  
:::

### Technical account (git commits)

Required for commit and push operations from the staging editor. See [Using Git](git_interaction.md)
for setup instructions.

| Variable                     | Default           | Description                                                     |
| ---------------------------- | ----------------- | --------------------------------------------------------------- |
| `TECHNICAL_ACCOUNT_TOKEN`    | _(none)_          | Technical account token (PAT) with repository write permission. |
| `TECHNICAL_ACCOUNT_USERNAME` | `weiss-bot`       | Technical account username. Used for commit history logs        |
| `TECHNICAL_ACCOUNT_EMAIL`    | `weiss-bot@dummy` | Technical account email. Used for commit history logs           |
