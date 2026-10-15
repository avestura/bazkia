import React from "react"
import ReactDOM from "react-dom/client"
import "@fontsource-variable/inter"
import "@fontsource-variable/inter-tight"
import "@fontsource-variable/jetbrains-mono"
import "@xyflow/react/dist/style.css"
import "./styles/boxy.css"
import "./styles/boxy-components.css"
import "./styles/app.css"
import "./tools"
import App from "./App"

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
