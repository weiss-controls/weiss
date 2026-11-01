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
