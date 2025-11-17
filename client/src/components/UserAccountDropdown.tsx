import { User, LogOut, Settings, Crown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function UserAccountDropdown() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Logout failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
      toast({
        title: "Logged out successfully",
        description: "You have been logged out of your account.",
      });
    },
    onError: () => {
      toast({
        title: "Logout failed",
        description: "An error occurred while logging out.",
        variant: "destructive",
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/account/delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
      toast({
        title: "Account deleted",
        description: "Your account has been permanently deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "An error occurred while deleting your account.",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleDeleteAccount = () => {
    deleteAccountMutation.mutate();
    setShowDeleteDialog(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" data-testid="button-account-menu">
            <User className="w-5 h-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64" data-testid="dropdown-account-menu">
          <DropdownMenuLabel>
            <div className="flex flex-col gap-1">
              {isAuthenticated ? (
                <>
                  <div className="text-sm font-medium" data-testid="text-account-user">
                    {(user?.firstName || user?.lastName) 
                      ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                      : user?.username || user?.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={user?.isPro ? "default" : "secondary"}
                      className="text-xs"
                      data-testid={`badge-account-${user?.isPro ? "pro" : "free"}`}
                    >
                      {user?.isPro ? "Pro Account" : "Free Account"}
                    </Badge>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-medium" data-testid="text-account-guest">
                    Guest User
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Sign up to save your progress
                  </div>
                </>
              )}
            </div>
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />

          {isAuthenticated ? (
            <>
              <DropdownMenuItem asChild data-testid="menu-item-settings" className="cursor-pointer">
                <Link href="/account/settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Account Settings
                </Link>
              </DropdownMenuItem>

              {!user?.isPro && (
                <DropdownMenuItem asChild data-testid="menu-item-upgrade" className="cursor-pointer">
                  <Link href="/subscribe">
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade to Pro
                  </Link>
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
                data-testid="menu-item-logout"
                className="cursor-pointer"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log Out
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive focus:text-destructive cursor-pointer"
                data-testid="menu-item-delete"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem asChild data-testid="menu-item-login" className="cursor-pointer">
              <Link href="/login">
                <User className="w-4 h-4 mr-2" />
                Sign Up / Log In
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-delete-account">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete your account? This action cannot be undone.
              All your game progress, puzzle completions, and leaderboard entries will be
              permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
