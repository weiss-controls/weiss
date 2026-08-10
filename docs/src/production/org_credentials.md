# Organization credentials

WEISS' backend expects a standard OpenID Connect issuer by default. The usual procedure is to
register WEISS as an OIDC client in your identity provider, and let that provider handle the
organization credentials.

::{hint}  
Your identity provider is likely managed by your IT department, and may be Microsoft Entra ID, ADFS,
Keycloak, or another SSO gateway. For more information, see
[What is an Identity Provider?](https://www.openiam.com/customer-identity-concepts/what-is-an-identity-provider).  
:::

This page covers two common deployment patterns:

- an organization that already has LDAP and needs a broker in front of it
- an organization that already uses identity services (e.g. Microsoft Entra ID).

In both cases, the WEISS-side configuration is the same: set the OIDC client values in the `.env`
file and register the callback URL in the identity provider.

---

## Common WEISS configuration

The backend uses these variables for the non-demo login provider:

```dotenv
AUTH_CLIENT_ID="your-client-id-here"
AUTH_CLIENT_SECRET="your-client-secret-here"
AUTH_ISSUER="https://your-issuer.example.com/realms/your-realm"
AUTH_IDENTITY_PROVIDER="oauth"
```

The redirect URL (after a successful authentication) is derived from the application URL, and always
uses the frontend callback path:

```text
https://<your-app-host>/auth/callback
```

For local development, that is typically:

```text
http://localhost:5173/auth/callback
```

If `DEV_MODE=true`, WEISS uses the Vite development port when building the frontend origin.
Otherwise, it uses the production hostname configured in `APP_HOSTNAME`, together with
`ENABLE_HTTPS`.

:::{important}  
For an official deployment, remind to set `DEMO_MODE=false` to ensure the Identity Provider route is
used, and `ENABLE_HTTPS=true` to ensure transactions are encrypted.  
:::

---

## Scenario 1: LDAP through an identity broker

This is the most common pattern when the facility already has LDAP to be associated with a web SSO.

### Recommended approach

Use an identity broker that can authenticate against LDAP and expose OIDC to applications. Common
choices are Keycloak, AD FS, Entra ID with directory synchronization, or a similar SSO gateway.
Check with your IT department to see if one of those is already in use.

In that model:

1. The broker connects to LDAP and validates usernames and passwords.
2. The broker issues OIDC tokens to WEISS.
3. WEISS receives the authenticated identity from the OIDC provider and maps it to a local user. The
   user's role and permissions are still managed in WEISS via the `roles.toml` configuration file
   (see [User roles](user_roles.md)).

### Setup steps

1. Create an OIDC client in the broker for WEISS.
2. Set the redirect URI to the WEISS callback URL (https://<weiss-hostname>/auth/callback).
3. Copy the client ID and client secret into `.env` (`AUTH_CLIENT_ID` and `AUTH_CLIENT_SECRET`
   variables).
4. Set `AUTH_ISSUER` to the broker issuer URL.
5. Keep `AUTH_IDENTITY_PROVIDER="oauth"`, unless you are using a custom provider module that you
   implemented.

### Example

For a Keycloak deployment, the issuer usually looks like:

```text
https://keycloak.example.com/realms/operations
```

and the redirect URI registered on the client is:

```text
https://weiss.example.com/auth/callback
```

With that setup, LDAP stays behind Keycloak and WEISS only sees the OIDC client.

:::{note}  
The built-in `oauth` provider is designed for OIDC, not raw LDAP. If your facility uses LDAP
directly or cannot expose OIDC, please open a
[GitHub issue](https://github.com/weiss-controls/weiss/issues/new) and we can provide support for a
new provider or assist with the best approach. Pull requests are also welcome if you want to
implement a new provider yourself.  
:::

---

## Scenario 2: Microsoft identity services

If the facility already uses Microsoft Entra ID, ADFS, or another Microsoft-backed OIDC provider,
you can use the built-in `oauth` provider directly.

### Recommended approach

Register WEISS as an application in Microsoft identity, then configure it as an OIDC client.

In that model:

1. Microsoft handles user authentication and MFA.
2. WEISS receives OIDC claims such as the username and email.
3. The backend maps that identity to the local WEISS role model, according to the `roles.toml`
   configuration file.

### Setup steps

1. Create a new application registration in the Microsoft identity portal.
2. Add the WEISS callback URL as a web redirect URI (https://<weiss-hostname>/auth/callback).
3. Create a client secret for the application.
4. Copy the application (client) ID and secret into `.env` (`AUTH_CLIENT_ID` and
   `AUTH_CLIENT_SECRET` variables).
5. Set `AUTH_ISSUER` to the Microsoft OIDC issuer for the tenant.
6. Keep `AUTH_IDENTITY_PROVIDER="oauth"`.

### Example

For a tenant-specific Entra ID setup, the redirect URI might be:

```text
https://weiss.example.com/auth/callback
```

and the issuer will be the tenant issuer URL for that directory.

:::{note} If the organization already uses Microsoft identity, you usually do not need a custom
WEISS provider. You only need a provider change if the upstream system does not expose OIDC. :::

---

## Choosing the right setup

Use the built-in OIDC provider when your organization can expose OIDC, either directly or through an
identity broker.

- Choose the LDAP-through-broker path when LDAP is the authoritative directory.
- Choose the Microsoft path when the organization already has Entra ID or ADFS in place.
- Add a new WEISS provider only when OIDC is not available and cannot be added externally.
- Ask your IT department or credential administrator for guidance on which path is best for your
  organization.
