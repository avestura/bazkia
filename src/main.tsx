import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { MainLayout } from "./layouts/MainLayout";
import "./global.css"
import { DesignerContextProvider } from "./components/designer/designerContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <DesignerContextProvider>
      <MainLayout />
    </DesignerContextProvider>
  </React.StrictMode>,
);
