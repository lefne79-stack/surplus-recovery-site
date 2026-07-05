import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import RecoverOS from "./RecoverOS.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RecoverOS />
  </StrictMode>
);
