import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import StudentsPage from "@/pages/students";
import SchedulePage from "@/pages/schedule";
import AlertsPage from "@/pages/alerts";
import AdminCohortsPage from "@/pages/admin-cohorts";
import InstructorsPage from "@/pages/instructors";
import SettingsPage from "@/pages/settings";
import AuthPage from "@/pages/auth";
import ResetPasswordPage from "@/pages/reset-password";
import { AppSidebar } from "@/components/app-sidebar";
import { StarField } from "@/components/star-field";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

function AppLayout() {
  return (
    <div className="flex h-screen relative">
      <StarField />
      <AppSidebar />
      <main className="flex-1 overflow-auto relative z-[1]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:pl-6">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/students" component={StudentsPage} />
            <Route path="/schedule" component={SchedulePage} />
            <Route path="/alerts" component={AlertsPage} />
            <Route path="/cohorts" component={AdminCohortsPage} />
            <Route path="/instructors" component={InstructorsPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </main>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Reset-password is accessible without authentication
  if (window.location.pathname === "/reset-password") {
    return <ResetPasswordPage />;
  }

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return <AppLayout />;
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <div className="h-screen flex flex-col bg-background">
            <Router />
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
