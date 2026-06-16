import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";
import { initCatalyst } from "./services/authService";
import { getRouterBasename } from "./utils/routerBase";

initCatalyst();

const basename = getRouterBasename();

console.log("[CrimePulse AI] App mounted");
console.log("[CrimePulse AI] Current pathname:", window.location.pathname);
console.log("[CrimePulse AI] Router basename:", basename);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
