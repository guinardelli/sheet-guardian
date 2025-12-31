import { initSentry } from "@/lib/sentry";
import { createRoot } from "react-dom/client";
import { initErrorTracker } from "@/lib/error-tracker";
import "@/lib/i18n";
import App from "./App.tsx";
import "./index.css";

initSentry();
initErrorTracker();

createRoot(document.getElementById("root")!).render(<App />);
