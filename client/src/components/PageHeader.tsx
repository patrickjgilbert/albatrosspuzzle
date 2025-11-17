import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";
import { Link } from "wouter";
import { AppLogo } from "./AppLogo";
import ThemeToggle from "./ThemeToggle";
import { UserAccountDropdown } from "./UserAccountDropdown";
import { useAuth } from "@/hooks/useAuth";

interface PageHeaderProps {
  children?: React.ReactNode;
}

export function PageHeader({ children }: PageHeaderProps) {
  const { user, isAuthenticated } = useAuth();

  return (
    <header className="flex items-center justify-between h-16 px-4 md:px-6 border-b border-border flex-shrink-0">
      <div className="flex items-center gap-4">
        <AppLogo />
        {children}
      </div>
      <div className="flex items-center gap-2">
        {!isAuthenticated && (
          <Button variant="outline" size="sm" asChild data-testid="button-header-login">
            <Link href="/login">Log In</Link>
          </Button>
        )}
        {isAuthenticated && !user?.isPro && (
          <Button variant="ghost" size="sm" asChild data-testid="button-header-upgrade">
            <Link href="/subscribe">
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to Pro
            </Link>
          </Button>
        )}
        <UserAccountDropdown />
        <ThemeToggle />
      </div>
    </header>
  );
}
