import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Protocols } from "./pages/Protocols";
import { Templates } from "./pages/Templates";
import { ProtocolEditor } from "./pages/ProtocolEditor";
import { LoginPage } from "./pages/auth/LoginPage";
import { AccessDeniedPage } from "./pages/auth/AccessDeniedPage";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/access-denied",
    Component: AccessDeniedPage,
  },
  {
    Component: ProtectedRoute,
    children: [
      {
        path: "/",
        Component: Layout,
        children: [
          { index: true, Component: Dashboard },
          { path: "protocols", Component: Protocols },
          { path: "protocols/:protocolId", Component: ProtocolEditor },
          { path: "templates", Component: Templates },
        ],
      },
    ],
  },
]);
