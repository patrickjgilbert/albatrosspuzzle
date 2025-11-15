import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Play, Trophy } from "lucide-react";

interface Puzzle {
  id: string;
  slug: string;
  title: string;
  description: string;
  isFree: boolean;
  difficulty: string;
}

export default function PuzzlesPage() {
  const { user, isAuthenticated } = useAuth();

  const { data: puzzles, isLoading } = useQuery<Puzzle[]>({
    queryKey: ["/api/puzzles"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading puzzles"/>
      </div>
    );
  }

  const canAccessPuzzle = (puzzle: Puzzle) => {
    if (puzzle.isFree) return true;
    return user?.isPro;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-page-title">Lateral Thinking Puzzles</h1>
              <p className="text-muted-foreground mt-1">
                Solve mysterious scenarios through yes/no questions
              </p>
            </div>
            {isAuthenticated && (
              <Link href="/leaderboard">
                <Button variant="outline" data-testid="button-leaderboard">
                  <Trophy className="h-4 w-4 mr-2" />
                  Leaderboard
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {!user?.isPro && (
          <Card className="mb-8 border-primary">
            <CardHeader>
              <CardTitle>Unlock All Puzzles</CardTitle>
              <CardDescription>
                Get lifetime access to all 5 Pro puzzles for just $1
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Link href="/subscribe">
                <Button data-testid="button-upgrade-pro">
                  Upgrade to Pro - $1 Lifetime
                </Button>
              </Link>
            </CardFooter>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {puzzles?.map((puzzle) => {
            const hasAccess = canAccessPuzzle(puzzle);
            
            return (
              <Card key={puzzle.id} className={!hasAccess ? "opacity-60" : ""} data-testid={`card-puzzle-${puzzle.slug}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex-1">{puzzle.title}</CardTitle>
                    <div className="flex flex-col gap-1">
                      {!puzzle.isFree && (
                        <Badge variant="secondary" data-testid={`badge-pro-${puzzle.slug}`}>
                          Pro
                        </Badge>
                      )}
                      <Badge variant="outline" className="capitalize">
                        {puzzle.difficulty}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="line-clamp-3">
                    {puzzle.description}
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  {hasAccess ? (
                    <Link href={`/game/${puzzle.slug}`} className="w-full">
                      <Button className="w-full" data-testid={`button-play-${puzzle.slug}`}>
                        <Play className="h-4 w-4 mr-2" />
                        Play Puzzle
                      </Button>
                    </Link>
                  ) : (
                    <Button className="w-full" disabled data-testid={`button-locked-${puzzle.slug}`}>
                      <Lock className="h-4 w-4 mr-2" />
                      Pro Access Required
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
