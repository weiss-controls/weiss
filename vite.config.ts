import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "child_process";
import { visualizer } from "rollup-plugin-visualizer";

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
  plugins: [react(), ...(process.env.BUILD_STATS ? [visualizer()] : [])],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    // plotly.js/lib/core pulls in CJS deps (e.g. has-hover) that reference Node's
    // `global` directly. Since we build a custom bundle, we need to add a ref to it here.
    global: "globalThis",
  },
  optimizeDeps: {
    esbuildOptions: {
      define: { global: "globalThis" },
    },
  },
});
