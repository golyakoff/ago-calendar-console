import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.js";
import { AuthProvider } from "./auth/AuthProvider.js";
import "./index.css";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("index.html has no #root element.");
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
