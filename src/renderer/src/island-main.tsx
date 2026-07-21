import React from "react";
import { createRoot } from "react-dom/client";
// The island's own entry (island.html → this file). Deliberately minimal: it pulls in the shared
// stylesheet but NOT the App tree, xterm, the chart runtime, shiki, or the JetBrains Mono font —
// the overlay is a small pill + inbox in the system font, so its window loads a fraction of the
// main renderer bundle. See electron.vite.config.ts's multi-entry input and main/island/window.ts.
import "./index.css";
import { IslandView } from "./island/IslandView";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <IslandView />
  </React.StrictMode>,
);
