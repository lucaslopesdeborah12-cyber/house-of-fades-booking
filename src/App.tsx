import { useState, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n/LanguageContext";
import LoadingScreen from "@/components/LoadingScreen";
import Index from "./pages/Index.tsx";
import BarberPortal from "./pages/BarberPortal.tsx";
import AdminPortal from "./pages/AdminPortal.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => {
  const [loaded, setLoaded] = useState(false);
  const onDone = useCallback(() => setLoaded(true), []);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {!loaded && <LoadingScreen onDone={onDone} />}
        <div className="grain-overlay" />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/barber" element={<BarberPortal />} />
            <Route path="/admin" element={<AdminPortal />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
