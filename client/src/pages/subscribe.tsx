import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, CreditCard, LogIn } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, parseJsonResponse, queryClient } from "@/lib/queryClient";
import { AppLogo } from "@/components/AppLogo";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";

// Use test Stripe key in development, production key only when explicitly set
// Default to test key unless MODE is explicitly "production"
const isProduction = import.meta.env.MODE === 'production';
const stripePublicKey = isProduction
  ? import.meta.env.VITE_STRIPE_PUBLIC_KEY
  : (import.meta.env.TESTING_VITE_STRIPE_PUBLIC_KEY || import.meta.env.VITE_STRIPE_PUBLIC_KEY);

if (!stripePublicKey) {
  throw new Error('Missing required Stripe publishable key');
}

const stripePromise = loadStripe(stripePublicKey);

const SubscribeForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/subscribe?payment_status=success`,
      },
    });

    setIsProcessing(false);

    if (error) {
      let errorTitle = "Payment Failed";
      let errorDescription = error.message || "An error occurred during payment";

      // Provide specific error messages based on error type
      if (error.type === "card_error") {
        errorTitle = "Card Declined";
        if (error.code === "card_declined") {
          errorDescription = "Your card was declined. Please try a different payment method.";
        } else if (error.code === "insufficient_funds") {
          errorDescription = "Insufficient funds. Please use a different card.";
        } else if (error.code === "incorrect_cvc") {
          errorDescription = "Incorrect CVC code. Please check and try again.";
        } else if (error.code === "expired_card") {
          errorDescription = "Your card has expired. Please use a different card.";
        }
      } else if (error.type === "validation_error") {
        errorTitle = "Invalid Payment Details";
        errorDescription = "Please check your payment information and try again.";
      } else if (error.type === "api_connection_error") {
        errorTitle = "Network Error";
        errorDescription = "Unable to connect to payment processor. Please check your internet connection.";
      }

      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button 
        type="submit" 
        className="w-full" 
        size="lg"
        disabled={!stripe || !elements || isProcessing}
        data-testid="button-subscribe"
      >
        {isProcessing ? "Processing..." : "Pay $1 (Lifetime Access)"}
      </Button>
    </form>
  );
};

type PageStatus = "loading" | "ready" | "already-pro" | "error" | "unauthenticated";

export default function Subscribe() {
  const [clientSecret, setClientSecret] = useState("");
  const [status, setStatus] = useState<PageStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);
  const requestInFlightRef = useRef(false);
  const { toast} = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const initializePayment = async () => {
    // Prevent concurrent requests using ref (survives re-renders)
    if (requestInFlightRef.current) {
      return;
    }

    // Fetch fresh auth state (fetchQuery returns the data directly, not just from cache)
    let freshAuthData;
    try {
      freshAuthData = await queryClient.fetchQuery({
        queryKey: ["/api/auth/user"],
        queryFn: async () => {
          const res = await fetch("/api/auth/user", { credentials: "include" });
          if (res.status === 401) {
            return null; // Session expired or not authenticated
          }
          if (!res.ok) {
            throw new Error(`Auth check failed: ${res.status}`);
          }
          return await res.json();
        },
      });
    } catch (error: any) {
      // If auth check fails with non-401 error, treat as payment error (not auth issue)
      if (import.meta.env.DEV) {
        console.error("Auth refetch error:", error);
      }
      setErrorMessage("Unable to verify authentication. Please try again.");
      setStatus("error");
      return;
    }
    
    // Check authentication with fresh state before attempting payment initialization
    if (!freshAuthData) {
      setStatus("unauthenticated");
      return;
    }

    // Reset state for clean initialization
    requestInFlightRef.current = true;
    setIsRetrying(true);
    setClientSecret(""); // Clear any stale client secret
    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await apiRequest("POST", "/api/create-subscription", {});
      const data = await parseJsonResponse<{ clientSecret?: string; message?: string }>(response);

      // Production: remove logging before deploy
      if (import.meta.env.DEV) {
        console.log("Payment intent response:", data);
      }

      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setStatus("ready");
      } else if (data.message) {
        // Server explicitly returned a message (only happens for "already pro" case)
        setClientSecret(""); // No payment needed
        setStatus("already-pro");
        toast({
          title: "Already Pro",
          description: "You already have lifetime Pro access!",
        });
      } else {
        // Unexpected response format
        if (import.meta.env.DEV) {
          console.error("Unexpected response:", data);
        }
        setClientSecret(""); // Clear on error
        setErrorMessage("Unexpected response from server. Please try again.");
        setStatus("error");
      }
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Payment initialization error:", error);
      }
      
      // Detect 401 Unauthorized by checking if error message starts with "401:"
      // apiRequest throws errors in format: "${status}: ${text}"
      const is401 = error.message?.startsWith("401:");
      
      if (is401) {
        setClientSecret("");
        setStatus("unauthenticated");
        toast({
          title: "Session Expired",
          description: "Please log in again to continue.",
          variant: "destructive",
        });
      } else {
        setClientSecret(""); // Clear on error
        setErrorMessage(error.message || "Failed to initialize payment. Please try again.");
        setStatus("error");
        toast({
          title: "Error",
          description: error.message || "Failed to initialize payment",
          variant: "destructive",
        });
      }
    } finally {
      requestInFlightRef.current = false;
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    // Wait for auth check to complete
    if (authLoading) {
      return;
    }
    
    // If not authenticated, show login prompt
    if (!isAuthenticated) {
      setStatus("unauthenticated");
      return;
    }
    
    // Check if we're returning from Stripe redirect
    const urlParams = new URLSearchParams(window.location.search);
    const paymentIntent = urlParams.get('payment_intent');
    const redirectStatus = urlParams.get('redirect_status');
    
    // Priority 1: Confirm payment if returning from Stripe
    if (paymentIntent && redirectStatus === 'succeeded') {
      // Prevent duplicate confirmations
      if (requestInFlightRef.current) {
        return;
      }
      
      const confirmPayment = async () => {
        try {
          requestInFlightRef.current = true;
          setStatus("loading");
          
          const response = await apiRequest("POST", "/api/confirm-payment", {
            paymentIntentId: paymentIntent,
          });
          const data = await parseJsonResponse<{ success: boolean; message: string }>(response);
          
          if (data.success) {
            // Clear URL params
            window.history.replaceState({}, '', '/subscribe');
            
            // Invalidate auth cache to refresh Pro status
            await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
            
            setStatus("already-pro");
            toast({
              title: "Payment Successful! 🎉",
              description: "You now have lifetime Pro access to all puzzles!",
            });
          } else {
            setErrorMessage(data.message || "Payment confirmation failed");
            setStatus("error");
            toast({
              title: "Payment Issue",
              description: data.message || "Please contact support if payment was processed.",
              variant: "destructive",
            });
          }
        } catch (error: any) {
          if (import.meta.env.DEV) {
            console.error("Payment confirmation error:", error);
          }
          setErrorMessage(error.message || "Failed to confirm payment");
          setStatus("error");
          toast({
            title: "Confirmation Error",
            description: "Payment may have succeeded. Please refresh the page.",
            variant: "destructive",
          });
        } finally {
          requestInFlightRef.current = false;
        }
      };
      
      confirmPayment();
      return; // Don't initialize payment if confirming
    }
    
    // Priority 2: Initialize payment for new users
    initializePayment();
  }, [authLoading, isAuthenticated]);

  // Show loading state
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <AppLogo />
            <div className="h-6 w-px bg-border" />
            <h1 className="text-xl font-semibold">Loading...</h1>
          </div>
        </header>
        <div className="h-screen flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
        </div>
      </div>
    );
  }

  // Show login prompt for unauthenticated users
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <AppLogo />
              <div className="h-6 w-px bg-border" />
              <h1 className="text-xl font-semibold">Upgrade to Pro</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <div className="container mx-auto px-4 py-12 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="w-5 h-5" />
                Log In Required
              </CardTitle>
              <CardDescription>
                You need to create an account or log in to upgrade to Pro and get lifetime access to all puzzles.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-sm font-semibold mb-2">Pro Benefits:</p>
                <ul className="text-sm space-y-1">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span>Access to all 6 lateral thinking puzzles</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span>Lifetime access - $1 one-time payment</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span>Progress saved across devices</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span>Early access to new puzzles</span>
                  </li>
                </ul>
              </div>
              <Button asChild className="w-full" size="lg" data-testid="button-login">
                <Link href="/login">
                  <LogIn className="w-4 h-4 mr-2" />
                  Log In to Upgrade
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/">Play Free Puzzle</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show message if user already has Pro
  if (status === "already-pro") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <AppLogo />
              <div className="h-6 w-px bg-border" />
              <h1 className="text-xl font-semibold">Already Pro</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <div className="container mx-auto px-4 py-12 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>You're all set!</CardTitle>
              <CardDescription>
                You already have lifetime Pro access to all puzzles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/">Return to Game</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show error state
  if (status === "error") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <AppLogo />
              <div className="h-6 w-px bg-border" />
              <h1 className="text-xl font-semibold">Payment Error</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <div className="container mx-auto px-4 py-12 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Unable to Initialize Payment</CardTitle>
              <CardDescription>
                {errorMessage || "There was an error setting up the payment form. Please try again."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={initializePayment} 
                className="w-full" 
                data-testid="button-retry"
                disabled={isRetrying}
              >
                {isRetrying ? "Loading..." : "Try Again"}
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/">Return to Game</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Only render payment form when status is ready AND we have a valid client secret
  if (status !== "ready" || !clientSecret) {
    return null; // Should never reach here due to guards above, but TypeScript safety
  }

  // Detect test mode
  const isTestMode = stripePublicKey?.includes('pk_test');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <AppLogo />
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">Upgrade to Pro</h1>
              {isTestMode && (
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
                  Test Mode
                </Badge>
              )}
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Free</CardTitle>
              <CardDescription>Play the Albatross puzzle</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-4">$0</div>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="text-sm">Access to Albatross puzzle</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="text-sm">Leaderboard access</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-primary">
            <CardHeader>
              <CardTitle>Pro</CardTitle>
              <CardDescription>Lifetime unlimited access</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-4">$1<span className="text-base font-normal text-muted-foreground"> one-time</span></div>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="text-sm">All free features</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Unlimited puzzle library</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="text-sm">Early access to new puzzles</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Lifetime access</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Payment Details
            </CardTitle>
            <CardDescription>
              Secure one-time payment powered by Stripe. Get lifetime Pro access instantly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isTestMode && (
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 space-y-2">
                <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                  Test Mode - Use Test Card
                </p>
                <p className="text-sm text-yellow-600 dark:text-yellow-500 font-mono">
                  Card: 4242 4242 4242 4242
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-500">
                  Expiry: Any future date • CVC: Any 3 digits • ZIP: Any 5 digits
                </p>
              </div>
            )}
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <SubscribeForm />
            </Elements>
          </CardContent>
          <CardFooter className="text-sm text-muted-foreground">
            One-time payment. No recurring charges.
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
