import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { applyColorMode, getStoredColorMode } from "./utils/theme";
import "./styles/index.css";

applyColorMode(getStoredColorMode());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
