import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Game from "@/pages/game";
import Landing from "@/pages/landing";
import Leaderboard from "@/pages/leaderboard";
import Subscribe from "@/pages/subscribe";
import AdminPage from "@/pages/admin";
import PuzzlesPage from "@/pages/puzzles";
import AccountSettings from "@/pages/account-settings";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  return (
    <Switch>
      {/* Admin route - accessible regardless of auth status */}
      <Route path="/admin" component={AdminPage} />
      
      {/* Login/Register - accessible to everyone */}
      <Route path="/login" component={LoginPage} />
      
      {/* Game routes - accessible to both guests and authenticated users */}
      <Route path="/game/:slug" component={Game} />
      <Route path="/game" component={Game} />
      
      {/* Puzzle selection - accessible to both guests and authenticated users */}
      <Route path="/puzzles" component={PuzzlesPage} />
      
      {/* Leaderboard - accessible to everyone */}
      <Route path="/leaderboard" component={Leaderboard} />
      
      {/* Subscription - accessible to everyone (guests will be prompted to register) */}
      <Route path="/subscribe" component={Subscribe} />
      
      {/* Account settings - only for authenticated users */}
      <Route path="/account/settings" component={AccountSettings} />
      
      {!isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
        </>
      ) : (
        <>
          <Route path="/" component={PuzzlesPage} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
