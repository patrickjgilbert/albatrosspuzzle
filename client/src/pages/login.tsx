import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppLogo } from "@/components/AppLogo";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { SiGoogle } from "react-icons/si";

const loginSchema = z.object({
  username: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export default function LoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      firstName: "",
      lastName: "",
    },
  });

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/login", data);
      
      // Invalidate auth cache
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      toast({
        title: "Welcome back!",
        description: "You've successfully logged in.",
      });
      
      // Redirect to puzzles page
      setLocation("/puzzles");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid username or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/register", data);
      
      // Invalidate auth cache
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      toast({
        title: "Account created!",
        description: "Welcome to Albatross Puzzles.",
      });
      
      // Redirect to puzzles page
      setLocation("/puzzles");
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="container mx-auto px-4 py-6">
        <AppLogo />
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
        <div className="w-full max-w-5xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">Welcome to Albatross Puzzles</h1>
            <p className="text-muted-foreground">
              {isRegistering ? "Create an account to save your progress" : "Sign in to continue solving mysteries"}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Left Side - Email/Username Registration/Login */}
            <Card>
              <CardHeader>
                <CardTitle>{isRegistering ? "Create Account" : "Sign In"}</CardTitle>
                <CardDescription>
                  {isRegistering 
                    ? "Sign up with your email to start solving puzzles" 
                    : "Log in with your username or email"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isRegistering ? (
                  <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                    <div>
                      <Label htmlFor="register-username">Username</Label>
                      <Input
                        id="register-username"
                        {...registerForm.register("username")}
                        data-testid="input-register-username"
                        disabled={isLoading}
                      />
                      {registerForm.formState.errors.username && (
                        <p className="text-sm text-destructive mt-1">
                          {registerForm.formState.errors.username.message}
                        </p>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="register-firstname">First Name (Optional)</Label>
                        <Input
                          id="register-firstname"
                          {...registerForm.register("firstName")}
                          data-testid="input-register-firstname"
                          disabled={isLoading}
                        />
                      </div>
                      <div>
                        <Label htmlFor="register-lastname">Last Name (Optional)</Label>
                        <Input
                          id="register-lastname"
                          {...registerForm.register("lastName")}
                          data-testid="input-register-lastname"
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="register-password">Password</Label>
                      <Input
                        id="register-password"
                        type="password"
                        {...registerForm.register("password")}
                        data-testid="input-register-password"
                        disabled={isLoading}
                      />
                      {registerForm.formState.errors.password && (
                        <p className="text-sm text-destructive mt-1">
                          {registerForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading}
                      data-testid="button-register-submit"
                    >
                      {isLoading ? "Creating Account..." : "Create Account"}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => setIsRegistering(false)}
                      disabled={isLoading}
                      data-testid="button-switch-to-login"
                    >
                      Already have an account? Sign in
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                    <div>
                      <Label htmlFor="login-username">Username or Email</Label>
                      <Input
                        id="login-username"
                        {...loginForm.register("username")}
                        data-testid="input-login-username"
                        disabled={isLoading}
                      />
                      {loginForm.formState.errors.username && (
                        <p className="text-sm text-destructive mt-1">
                          {loginForm.formState.errors.username.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="login-password">Password</Label>
                      <Input
                        id="login-password"
                        type="password"
                        {...loginForm.register("password")}
                        data-testid="input-login-password"
                        disabled={isLoading}
                      />
                      {loginForm.formState.errors.password && (
                        <p className="text-sm text-destructive mt-1">
                          {loginForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading}
                      data-testid="button-login-submit"
                    >
                      {isLoading ? "Signing In..." : "Sign In"}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => setIsRegistering(true)}
                      disabled={isLoading}
                      data-testid="button-switch-to-register"
                    >
                      Need an account? Sign up
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            {/* Right Side - Google OAuth */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Sign In</CardTitle>
                <CardDescription>
                  Use your Google account for instant access
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center min-h-[300px]">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full max-w-sm"
                  asChild
                  data-testid="button-google-login"
                >
                  <a href="/api/login">
                    <SiGoogle className="w-5 h-5 mr-2" />
                    Continue with Google
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
