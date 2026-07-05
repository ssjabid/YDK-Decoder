import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/app.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// PWA: register the service worker for install + offline — production builds
// only, so the dev server (npm run dev / the preview) is never affected. The
// SW is network-first for HTML, so a new deploy always wins when online.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => { /* offline / unsupported — ignore */ });
  });
}
