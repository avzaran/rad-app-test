import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AppProviders } from "./providers/AppProviders";
import { AppErrorBoundary } from "./components/system/AppErrorBoundary";

export default function App() {
  return (
    <AppErrorBoundary>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </AppErrorBoundary>
  );
}
