import React from "react";
import { createRoot } from "react-dom/client";
// Bundle the mono UI font as an asset so the app renders identically offline — no remote CDN, no
// FOUT on a cold start. JetBrains Mono (telemetry, code, diffs, terminal) ships as a one-axis
// variable build. UI/body text uses the OS system sans (see --font-sans in index.css), so no
// sans webfont is bundled.
import "@fontsource-variable/jetbrains-mono";
import "./index.css";
import { App } from "./App";
import { IslandView } from "./island/IslandView";

// The notch-overlay window loads this same bundle with ?island=1 (see main/island/window.ts) and
// renders only the island UI — no router, same query-param branch the window itself was born with.
const isIsland =
  new URLSearchParams(window.location.search).get("island") === "1";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{isIsland ? <IslandView /> : <App />}</React.StrictMode>,
);
