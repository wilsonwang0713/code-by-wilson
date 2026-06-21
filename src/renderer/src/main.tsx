import React from "react";
import { createRoot } from "react-dom/client";
// Bundle the UI fonts as assets so the app renders identically offline — no remote CDN, no FOUT on a
// cold start. Inter (UI/body), Instrument Sans (placards/labels), and JetBrains Mono (telemetry) all
// ship as one-axis variable builds, one import each.
import "@fontsource-variable/inter";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/jetbrains-mono";
import "./index.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
