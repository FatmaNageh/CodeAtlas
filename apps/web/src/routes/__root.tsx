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
      { title: "CodeAtlas — Navigate Your Codebase" },
      {
        name: "description",
        content:
          "CodeAtlas builds a semantic knowledge graph from your repository — navigate, query, and understand real code structure instantly.",
      },
    ],
  }),
});

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Only the full-screen graph explorer hides the shared header
  const hideHeader = pathname === "/graph";

  return (
    <>
      <HeadContent />
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        disableTransitionOnChange
        storageKey="vite-ui-theme"
      >
        <div className="codeatlas-shell min-h-screen">
          {!hideHeader && <Header />}
          <main className={hideHeader ? "min-h-screen overflow-auto" : "min-h-[calc(100vh-64px)] overflow-auto"}>
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