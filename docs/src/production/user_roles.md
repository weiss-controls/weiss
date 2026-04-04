# Defining user roles

WEISS uses two roles to differentiate what users can do:

| Role          | Description                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Operator**  | Read-only access to repos. Can operate and view deployed OPI snapshots in runtime mode. Cannot edit files, commit, or deploy. |
| **Developer** | Full access. Can edit OPIs in the editor, commit changes, manage repositories, and deploy snapshots.                          |

Role assignment is controlled by a `roles.toml` file on the server. Any authenticated user whose
username is listed in that file is granted the developer role; everyone else is treated as an
operator.

:::{note} A simple config file is a deliberate choice for the current scale of the system, where the
number of users and roles changes infrequently and a full database service would be disproportionate
overhead. If your deployment grows to the point where dynamic role management, audit trails, or
per-repository permissions become necessary, this mechanism can be replaced with a database-backed
solution without changing the rest of the application.  
:::

---

## Setup

A template file is included in the repository at `backend/api/roles.example.toml`. Copy it to
`roles.toml` in the same directory and edit it:

```sh
cp backend/api/roles.example.toml roles.toml
```

The file uses [TOML](https://toml.io) format. Add the usernames of the users who should have the
developer role under `[roles]`:

```toml
[roles]
developers = [
    "andre@example.com",
    "flavia@example.com",
]
```

Keep `roles.toml` out of version control - it is already listed in `.gitignore`.

:::{note} The username format depends on the authentication provider in use:

- **Microsoft Entra ID** - use the user's `userPrincipalName` (UPN), typically their organisational
  email address (e.g. `username@example.com`).
- **Other providers** (e.g. LDAP, to be supported) - use the login name as it appears in the user's
  session (e.g. `username` or `DOMAIN\username`).

Usernames are matched case-insensitively.  
:::

---

## Mounting the file (Docker)

The compose files expect `roles.toml` to be mounted into the API container. By default, they look
for it at `./roles.toml` relative to the project root. If you want to keep it elsewhere, set
`ROLES_CONFIG_FILE` in your `.env` file:

```sh
ROLES_CONFIG_FILE=/path/to/your/roles.toml
```

The file is mounted read-only at `/config/roles.toml` inside the container.

---

## Applying changes without restarting

After editing `roles.toml`, you can reload it without restarting the server by calling the reload
endpoint - no existing user sessions are interrupted:

```sh
curl -X POST https://<your-host>/api/v1/auth/admin/reload-roles \
     -H "Cookie: weiss_session=<your-session-cookie>"
```

This endpoint requires the caller to already have the developer role. The response includes the
number of developer usernames loaded from the file:

```json
{ "reloaded": true, "developer_count": 2 }
```

Role changes take effect on the next request made by each user - there is no need to force anyone to
log out and back in.

:::{note} If `roles.toml` is not found when the server starts, a warning is logged and all users
fall back to the operator role. The file can be created and loaded at any time using the reload
endpoint above without restarting.  
:::
