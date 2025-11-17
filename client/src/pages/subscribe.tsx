import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, CreditCard } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, parseJsonResponse } from "@/lib/queryClient";
import { AppLogo } from "@/components/AppLogo";
import ThemeToggle from "@/components/ThemeToggle";

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
        return_url: `${window.location.origin}/?subscription=success`,
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

type PageStatus = "loading" | "ready" | "already-pro" | "error";

export default function Subscribe() {
  const [clientSecret, setClientSecret] = useState("");
  const [status, setStatus] = useState<PageStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);
  const requestInFlightRef = useRef(false);
  const { toast} = useToast();

  const initializePayment = async () => {
    // Prevent concurrent requests using ref (survives re-renders)
    if (requestInFlightRef.current) {
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
      setClientSecret(""); // Clear on error
      setErrorMessage(error.message || "Failed to initialize payment. Please try again.");
      setStatus("error");
      toast({
        title: "Error",
        description: error.message || "Failed to initialize payment",
        variant: "destructive",
      });
    } finally {
      requestInFlightRef.current = false;
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    initializePayment();
  }, []);

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
