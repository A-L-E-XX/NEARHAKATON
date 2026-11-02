import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// "./" makes the build work at any path, including GitHub Pages project sites.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
});
