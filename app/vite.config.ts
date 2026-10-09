import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        // Three.js changes far less often than the app code; a separate chunk
        // stays in the browser cache across deploys.
        manualChunks(id) {
          if (id.includes("/node_modules/three/")) return "three";
        },
      },
    },
    // The 3D engine is ~550 kB minified and loads lazily after the interface.
    chunkSizeWarningLimit: 700,
  },
});
