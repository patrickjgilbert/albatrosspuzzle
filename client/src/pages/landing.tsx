import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { Link } from "wouter";
import { Play } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <PageHeader />

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-5xl font-bold tracking-tight">
              Can You Solve the Mystery?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              A man walks into a restaurant, orders albatross soup, takes one bite, and shoots himself. Uncover the dark truth behind this classic lateral thinking puzzle.
            </p>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild data-testid="button-play-free">
              <Link href="/game/albatross">
                <Play className="w-5 h-5 mr-2" />
                Play Albatross Free
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild data-testid="button-get-started">
              <Link href="/login">Sign Up & Save Progress</Link>
            </Button>
          </div>

          {/* Features Grid */}
          <div id="how-it-works" className="grid md:grid-cols-3 gap-6 pt-16">
            <Card className="hover-elevate">
              <CardHeader>
                <CardTitle>🎯 Ask Questions</CardTitle>
                <CardDescription>
                  Ask yes-or-no questions to uncover the mystery piece by piece
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover-elevate">
              <CardHeader>
                <CardTitle>🧩 Discover Clues</CardTitle>
                <CardDescription>
                  Watch as post-it notes reveal the dark truth behind the puzzle
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover-elevate">
              <CardHeader>
                <CardTitle>🏆 Compete</CardTitle>
                <CardDescription>
                  Solve in the fewest questions and climb the leaderboard
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Pricing Teaser */}
          <div className="pt-16">
            <Card className="max-w-md mx-auto">
              <CardHeader>
                <CardTitle>Free to Start</CardTitle>
                <CardDescription>
                  Play the Albatross puzzle for free. Upgrade to Pro for just $1 (one-time payment) to access 5 additional lateral thinking puzzles.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full" size="lg" asChild>
                  <Link href="/game/albatross">
                    <Play className="w-5 h-5 mr-2" />
                    Start Playing Now
                  </Link>
                </Button>
                <Button variant="outline" className="w-full" size="lg" asChild>
                  <Link href="/leaderboard">View Leaderboard</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-20 border-t">
        <p className="text-center text-sm text-muted-foreground">
          © 2025 The Albatross Puzzle. Challenge your mind.
        </p>
      </footer>
    </div>
  );
}
