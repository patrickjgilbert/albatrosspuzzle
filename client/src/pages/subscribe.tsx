import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Check, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

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
      toast({
        title: "Payment Failed",
        description: error.message,
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

  const initializePayment = () => {
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

    apiRequest("POST", "/api/create-subscription", {})
      .then((data: any) => {
        // Production: remove logging before deploy
        if (import.meta.env.DEV) {
          console.log("Payment intent response:", data);
        }
        
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
          setStatus("ready");
        } else if (data.message) {
          // Server explicitly returned a message (only happens for "already pro" case)
          // Errors throw exceptions and go through .catch()
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
      })
      .catch((error: any) => {
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
      })
      .finally(() => {
        requestInFlightRef.current = false;
        setIsRetrying(false);
      });
  };

  useEffect(() => {
    initializePayment();
  }, []);

  // Show loading state
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
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
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <h1 className="text-xl font-semibold">Already Pro</h1>
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
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <h1 className="text-xl font-semibold">Payment Error</h1>
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild data-testid="button-back">
            <Link href="/">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">Upgrade to Pro</h1>
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
            <CardTitle>Payment Details</CardTitle>
            <CardDescription>
              Secure one-time payment powered by Stripe. Get lifetime Pro access instantly.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
