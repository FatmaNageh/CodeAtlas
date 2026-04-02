import Header from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import type { trpc } from "@/utils/trpc";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { HeadContent, Outlet, createRootRouteWithContext, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import "../index.css";
import "../styles/codeatlas-theme.css";

export interface RouterAppContext {
  trpc: typeof trpc;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    meta: [
      { title: "CodeAtlas — React Frontend" },
      {
        name: "description",
        content:
          "CodeAtlas frontend with landing page, onboarding flow, graph exploration, indexing tools, and analytics.",
      },
    ],
  }),
});

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideGlobalHeader = pathname === "/graph";
  return (
    <>
      <HeadContent />
      <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange storageKey="vite-ui-theme">
        <div className="codeatlas-shell min-h-screen">
          {!hideGlobalHeader && <Header />}
          <main className={hideGlobalHeader ? "min-h-screen overflow-auto" : "min-h-[calc(100vh-50px)] overflow-auto"}>
            <Outlet />
          </main>
        </div>
        <Toaster richColors />
      </ThemeProvider>

      <TanStackRouterDevtools position="bottom-left" />
      <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
    </>
  );
}
