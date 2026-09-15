import { StrictMode } from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"

// StrictMode double-invokes effects in development, which is precisely the
// case the hooks defend against — so the demo exercises it on every run.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
