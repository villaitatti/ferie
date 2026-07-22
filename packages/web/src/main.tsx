import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider, createTheme } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "dayjs/locale/it";
import "dayjs/locale/en";
import "./i18n";
import "./styles.css";
import { AuthBoundary } from "./auth";
import { App } from "./App";

const theme = createTheme({
  primaryColor: "forest",
  colors: { forest: ["#eff7f3", "#dcece4", "#b8d9c8", "#8fc2aa", "#63a88b", "#438d72", "#32715b", "#285b4a", "#21493d", "#17372e"] },
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  headings: { fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" },
  defaultRadius: "sm",
});
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <QueryClientProvider client={queryClient}>
        <AuthBoundary><BrowserRouter><App /></BrowserRouter></AuthBoundary>
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </MantineProvider>
  </React.StrictMode>,
);
