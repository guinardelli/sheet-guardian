import { createRoot } from "react-dom/client";
import { initErrorTracker } from "@/lib/error-tracker";
import App from "./App.tsx";
import "./index.css";

initErrorTracker();

createRoot(document.getElementById("root")!).render(<App />);
