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
- `weiss-demoioc`: EPICS demonstration IOC (see
  [exampleIOC contents](https://github.com/weiss-controls/weiss/tree/main/examples/exampleIOC)).

> For the API, the service should be restarted for endpoint changes to take effect. Remind to set
> `FRONTEND_URL` to `http://localhost:5173`.
