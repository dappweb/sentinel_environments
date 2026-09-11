import React from "react";
import ReactDOM from "react-dom/client";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { PrivyProvider } from "@privy-io/react-auth";
import App from "./App.tsx";
import "./index.css";

const app = (
  <React.StrictMode>
    <DndProvider backend={HTML5Backend}>
      <App />
    </DndProvider>
  </React.StrictMode>
);

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;

ReactDOM.createRoot(document.getElementById("root")!).render(
  privyAppId ? (
    <PrivyProvider
      appId={privyAppId}
      config={{ loginMethods: ["email", "google", "wallet"] }}
    >
      {app}
    </PrivyProvider>
  ) : app
);
