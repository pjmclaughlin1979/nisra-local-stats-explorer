import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// Relative base so the build works from any static host or subpath.
export default defineConfig({
  base: "./",
  plugins: [svelte()],
});
