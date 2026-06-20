import React from "react";
import { createRoot } from "react-dom/client";
// Bundle the UI fonts as assets so the app renders identically offline — no remote CDN, no FOUT on a
// cold start. Inter (UI/body) and JetBrains Mono (telemetry) ship as one-axis variable builds; Saira
// Semi Condensed (the placard/label face) has no variable build, so the 400–700 weights load as static.
import "@fontsource-variable/inter";
import "@fontsource/saira-semi-condensed/400.css";
import "@fontsource/saira-semi-condensed/500.css";
import "@fontsource/saira-semi-condensed/600.css";
import "@fontsource/saira-semi-condensed/700.css";
import "@fontsource-variable/jetbrains-mono";
import "./index.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
