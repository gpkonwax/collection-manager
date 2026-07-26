import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WaxProvider } from "@/context/WaxContext";
import { isOfflineBundle } from "@/lib/offlineBundle";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (!root.classList.contains('dark') && !root.classList.contains('bright')) {
      let stored: string | null = null;
      try { stored = window.localStorage.getItem('gpk-theme'); } catch { /* ignore */ }
      root.classList.add(stored === 'bright' ? 'bright' : 'dark');
    }
  }

  // Offline bundle opens from file:// where BrowserRouter refreshes 404. Use
  // HashRouter for that build only so deep links and refresh keep working.
  const Router = isOfflineBundle() ? HashRouter : BrowserRouter;
  const routerProps = isOfflineBundle()
    ? {}
    : { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WaxProvider>
          <Toaster />
          <Sonner />
          <Router {...routerProps}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
        </WaxProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
