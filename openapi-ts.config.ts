// @hey-api/openapi-ts is pinned to a `next` prerelease: stable releases require the TypeScript
// compiler API, which TypeScript 7 no longer provides. Move back to a stable release once one
// supports TypeScript 7: https://github.com/hey-api/hey-api/issues/4235
import { defineConfig } from "@hey-api/openapi-ts";
import { defaultPlugins } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "http://localhost:8000/openapi.json",
  output: { postProcess: ["prettier"], path: "src/services/APIClient" },
  plugins: [
    ...defaultPlugins,
    {
      name: "@hey-api/client-fetch",
      throwOnError: true,
      runtimeConfigPath: "@src/hey-api-fetch.ts",
    },
  ],
});
