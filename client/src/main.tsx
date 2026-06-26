import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";
import { initCatalyst } from "./services/authService";
import { getRouterBasename } from "./utils/routerBase";
import { getActiveDatasetId } from "./services/datasetScope";
import { AuthProvider } from "./auth/AuthContext";
import { DatasetAnalyticsProvider } from "./context/DatasetAnalyticsContext";
import { getStoredAuthUser, withUserScope } from "./lib/api";

initCatalyst();

const nativeFetch = window.fetch.bind(window);
window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const datasetId = getActiveDatasetId();
  const user = getStoredAuthUser();
  if (typeof input !== "string") return nativeFetch(input, init);
  const url = new URL(input, window.location.origin);
  if (url.pathname.includes("/server/") && !url.pathname.includes("/datasets") && !url.pathname.includes("/upload-")) {
    if (datasetId) url.searchParams.set("dataset_id", datasetId);
    Object.entries(withUserScope({}, user)).forEach(([key, value]) => url.searchParams.set(key, value));
    return nativeFetch(url.toString(), init);
  }
  return nativeFetch(input, init);
}) as typeof window.fetch;

const basename = getRouterBasename();

console.log("[CrimePulse AI] App mounted");
console.log("[CrimePulse AI] Current pathname:", window.location.pathname);
console.log("[CrimePulse AI] Router basename:", basename);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider><DatasetAnalyticsProvider><BrowserRouter basename={basename}><App /></BrowserRouter></DatasetAnalyticsProvider></AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
