import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { ErrorProvider } from "./hooks/ErrorContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <ErrorProvider>
    <App />
  </ErrorProvider>
);
