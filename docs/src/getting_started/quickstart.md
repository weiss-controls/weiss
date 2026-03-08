# Quick start - Demo

The quickest way to validate your build is to start with a demonstration HTTP setup, so you don't
need to configure credentials and certificates to use the app. This section will guide you through
it.

1. Install Docker

Instructions available [here](https://docs.docker.com/engine/install/).

2. Clone the repository:

```sh
git clone https://github.com/weiss-controls/weiss.git
```

3. Configure you environment.

First, create your `.env` file. You can start by just copying `.env.example` from the root folder:

```sh
cp .env.example .env
```

If you want to see PVs outside of localhost, adjust `DEFAULT_PROTOCOL` and `EPICS_XXX_ADDR_LIST`
accordingly.

:::{important}  
If running outside of your localhost, make sure to modify `FRONTEND_URL` with your server's IP
address or DNS name - this will add your server to the API's whitelist for access - all other
traffic is blocked.  
:::

The whole behaviour of the app is configured via environment variables. For this tutorial, most of
the times you don't need to change anything unless you want to. Take a look at the other variables
to get familiarized with the options.

4. Build and start the system. From the root of the repo, run:

```sh
docker compose up -d
```

Once built, three services should be launched:

- `weiss-epicsws`: the EPICS communication layer.
- `weiss-api`: the backend API for file and git interaction.
- `weiss`: WEISS front-end application - accessible at http://localhost (or your server address, if
  applicable).

:::{hint}  
If you do not have an IOC available for testing, try running the development demo IOC:
`docker compose -f docker-compose-dev.yml up -d weiss-demoioc`. This will build and run the
[example IOC](https://github.com/weiss-controls/weiss/tree/main/examples/exampleIOC). A set of OPIs
using the appropriate PVs can be imported from
[weiss-demo-opis](https://github.com/weiss-controls/weiss-demo-opis) using WEISS file browser.  
:::

You should now be able to import public repositories and explore the tool. For a production-grade
setup (HTTPS, enabling git write and login credentials), see `Production setup` section, starting
with [Environment variables](../production/env_variables.md).
