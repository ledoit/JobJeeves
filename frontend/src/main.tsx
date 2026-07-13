import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

(() => {
  const host = window.location.hostname;
  if (host === "jobjeeves.menhir-holdings.com") return;
  if (host.endsWith(".vercel.app")) {
    const next = new URL(window.location.href);
    next.hostname = "jobjeeves.menhir-holdings.com";
    next.protocol = "https:";
    window.location.replace(next.toString());
  }
})();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

