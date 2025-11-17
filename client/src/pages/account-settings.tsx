import { useAuth } from "@/hooks/useAuth";
import { AppLogo } from "@/components/AppLogo";
import ThemeToggle from "@/components/ThemeToggle";
import { UserAccountDropdown } from "@/components/UserAccountDropdown";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import { Crown, ArrowLeft, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
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
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function AccountSettings() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Profile form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
    }
  }, [user]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      await apiRequest("/api/account/update", "PATCH", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

      // Invalidate auth cache to refresh user data
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await apiRequest("/api/account/delete", "DELETE");

      toast({
        title: "Account deleted",
        description: "Your account has been permanently deleted.",
      });

      // Invalidate auth cache
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });

      // Redirect to home
      setTimeout(() => {
        setLocation("/");
      }, 1000);
    } catch (error) {
      toast({
        title: "Deletion failed",
        description: "Failed to delete account. Please try again.",
        variant: "destructive",
      });
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const hasProfileChanges = 
    firstName !== (user.firstName || "") || 
    lastName !== (user.lastName || "");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <AppLogo />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <UserAccountDropdown />
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" asChild data-testid="button-back">
            <Link href="/puzzles">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Puzzles
            </Link>
          </Button>
        </div>

        <h1 className="text-3xl font-bold mb-8" data-testid="text-page-title">Account Settings</h1>

        <div className="space-y-6">
          {/* Profile Editing */}
          <Card data-testid="card-profile">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Update your profile information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter first name"
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter last name"
                    data-testid="input-last-name"
                  />
                </div>
              </div>
              <Button 
                onClick={handleSaveProfile} 
                disabled={!hasProfileChanges || isSaving}
                data-testid="button-save-profile"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>

          {/* Account Information */}
          <Card data-testid="card-account-info">
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Your account details and status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Username</div>
                  <div className="font-medium" data-testid="text-username">{user.username || "N/A"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Email</div>
                  <div className="font-medium" data-testid="text-email">{user.email || "N/A"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Account Status</div>
                  <Badge
                    variant={user.isPro ? "default" : "secondary"}
                    data-testid={`badge-status-${user.isPro ? "pro" : "free"}`}
                  >
                    {user.isPro ? "Pro Account" : "Free Account"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {!user.isPro && (
            <Card className="border-primary" data-testid="card-upgrade">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-primary" />
                  Upgrade to Pro
                </CardTitle>
                <CardDescription>
                  Get lifetime access to all 5 Pro puzzles for just $1
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild data-testid="button-upgrade-pro">
                  <Link href="/subscribe">
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade Now - $1 Lifetime
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card data-testid="card-subscription">
            <CardHeader>
              <CardTitle>Subscription Details</CardTitle>
              <CardDescription>Your current subscription information</CardDescription>
            </CardHeader>
            <CardContent>
              {user.isPro ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" data-testid="badge-active-pro">Pro Access Active</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    You have lifetime access to all Pro puzzles. No recurring charges.
                  </p>
                  {user.stripeCustomerId && (
                    <p className="text-xs text-muted-foreground mt-4">
                      Customer ID: {user.stripeCustomerId}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    You are currently on the free plan. Upgrade to Pro to unlock all puzzles.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-destructive/50" data-testid="card-danger-zone">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions that will affect your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Deleting your account will permanently remove all your data, including
                game progress, puzzle completions, and leaderboard entries.
              </p>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                data-testid="button-delete-account"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your account
              and remove all your data from our servers, including:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-sm space-y-1 my-2">
            <p>• All game progress and puzzle completions</p>
            <p>• Leaderboard entries and rankings</p>
            <p>• Account information and preferences</p>
            {user.isPro && <p className="font-semibold text-destructive">• Your Pro subscription access</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {isDeleting ? "Deleting..." : "Delete Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
