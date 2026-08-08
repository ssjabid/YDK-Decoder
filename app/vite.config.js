import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the built app works when served from any subpath
// (e.g. localhost:8000/app/ or wherever we cut over), sharing localStorage
// with the existing data. Dev server pinned to 5174 so it never clashes
// with the user's py http.server on 8000.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5174, strictPort: true },
  // Firebase is loaded via dynamic import (lazy) — pre-bundle it up front so
  // the dev server doesn't split @firebase/app across two module copies
  // ("Service firestore is not available"). Prod builds are unaffected.
  optimizeDeps: { include: ["firebase/app", "firebase/auth", "firebase/firestore"] },
});
