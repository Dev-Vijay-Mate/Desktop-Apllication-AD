const { defineConfig } = require("vite");

module.exports = defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: "localhost",
    port: 4173,
    strictPort: true,
  },
});