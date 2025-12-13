// Some build/test environments load the entry from /index.tsx.
// This file delegates to the Vite entry to avoid "Missing semicolon" parser issues.
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./src/App";
import "./src/styles.css";

const root = document.getElementById("root");
if (!root) {
  // In dev-server contexts, index.html uses /src/main.tsx — no root yet.
  // Create it defensively so both paths work.
  const el = document.createElement("div");
  el.id = "root";
  document.body.appendChild(el);
}
const mount = document.getElementById("root");
if (!mount) throw new Error("Root element #root not found");
ReactDOM.createRoot(mount).render(<App />);


