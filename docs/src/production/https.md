# Enabling HTTPS

HTTPS is handled entirely by the nginx container (`weiss`). No changes are needed to the API or
epicsWS services - they communicate on the internal Docker network over plain HTTP.

---

## Prerequisites

You need a valid TLS certificate and private key in PEM format. Obtain them from your certificate
authority, or generate self-signed certificates for testing:

```sh
openssl req -x509 -newkey rsa:4096 -keyout privkey.pem -out fullchain.pem \
  -days 365 -nodes -subj "/CN=your-server-hostname"
```

Since NGINX runs in an unprivileged container, you may need the following to allow the service to
read the private key file (101 is the `nginx` UID in the container):

```sh
sudo chown root:101 /path/to/privkey.pem && sudo chmod 640 /path/to/privkey.pem
```

Place the files anywhere on the host that the `weiss` container can read (they are mounted
read-only).

---

## Configuration

In your `.env` file:

```sh
ENABLE_HTTPS=true
SSL_CERT_FILE=/path/to/fullchain.pem
SSL_KEY_FILE=/path/to/privkey.pem
APP_HOSTNAME=your-server-hostname
```

The scheme for CORS and OAuth redirect URIs is derived automatically from `ENABLE_HTTPS`, so no
separate URL variable is needed.

- nginx uses the HTTPS template (`nginx/default.https.template`) which listens on port 443 and
  redirects HTTP (port 80) to HTTPS.
- The API sets the `Secure` flag on session cookies so they are only sent over HTTPS.

Restart the stack after changing these values:

```sh
docker compose up -d
```

---

## Optional: NGINX setup

The nginx configuration templates are located in `nginx/`. Two templates are provided:

| File                     | Used when                      |
| ------------------------ | ------------------------------ |
| `default.http.template`  | `ENABLE_HTTPS=false` (default) |
| `default.https.template` | `ENABLE_HTTPS=true`            |

The Docker entrypoint (`nginx/docker-entrypoint.sh`) selects the correct template at container start
based on the `ENABLE_HTTPS` environment variable and substitutes `APP_HOSTNAME`, `DOCS_HOSTNAME`,
and the certificate paths into the template.

An optional third template (`default.docs.template`) is appended to the HTTPS config when
`DOCS_HOSTNAME` is set, adding a reverse-proxy server block for the documentation service.

If you need custom nginx directives (e.g., additional proxy headers, rate limiting, or custom
locations), edit the relevant template file before building the image. The templates follow standard
nginx `envsubst` syntax.

See more details on the nginx configuration in the [nginx docs](https://nginx.org/en/docs/).
