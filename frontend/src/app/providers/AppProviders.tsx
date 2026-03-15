import { PropsWithChildren, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "../components/ui/sonner";
import { useAuthBootstrap } from "../hooks/useAuthBootstrap";
import "../i18n";

function AuthBootstrapper({ children }: PropsWithChildren) {
  useAuthBootstrap();
  return children;
}

export function AppProviders({ children }: PropsWithChildren) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
    []
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AuthBootstrapper>{children}</AuthBootstrapper>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
