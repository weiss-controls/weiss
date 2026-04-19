import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "child_process";

function getVersion(): string {
  return execSync("git describe --tags --always --dirty").toString().trim();
}

const version = getVersion();

export default defineConfig({
  resolve: {
    alias: {
      "@src": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
    },
  },
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
});
